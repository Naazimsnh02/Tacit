from __future__ import annotations

import base64
import json
import os
import tempfile
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .video_sampling import VideoSamplingError, sample_video_frames, video_duration_ms


class SourceIntelligenceError(Exception):
    """A safe, retryable failure in post-scan source understanding."""


@dataclass(frozen=True)
class ClaimedPlatformJob:
    job_id: str
    attempts: int
    project_id: str
    kind: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class SourceArtifact:
    id: str
    project_id: str
    media_type: str
    storage_key: str
    storage_version: str | None
    checksum_sha256: str


class SourceIntelligenceWorker:
    """Turns scan-cleared sources into cited, validated intelligence records.

    The worker never reads an upload before the ingestion worker has marked its
    artifact clean and ready. It sends only source bytes needed for visual
    interpretation; models receive no signed Storage URLs or service credentials.
    """

    def __init__(self, environment: dict[str, str] | None = None) -> None:
        self.env = environment or dict(os.environ)
        self.supabase_url = self._required("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
        self.service_key = self._required("SUPABASE_SERVICE_ROLE_KEY")
        self.source_llm_backend = self.env.get("EVIDENCE_SOURCE_INTELLIGENCE_BACKEND") or self.env.get(
            "LLM_BACKEND", "openai_api"
        )
        self.openai_key = self.env.get("OPENAI_API_KEY")
        self.vision_model = self.env.get("EVIDENCE_VISION_MODEL")
        self.codex_runner_url = self.env.get("CODEX_SUBSCRIPTION_RUNNER_URL", "").rstrip("/")
        self.codex_runner_secret = self.env.get("CODEX_SUBSCRIPTION_RUNNER_SECRET")
        self.codex_subscription_model = self.env.get("CODEX_SUBSCRIPTION_MODEL")
        self.vision_detail = self.env.get("EVIDENCE_VISION_DETAIL", "high")
        self.vision_escalation_detail = self.env.get("EVIDENCE_VISION_ESCALATION_DETAIL", "original")
        self.minimum_confidence = float(self.env.get("EVIDENCE_VISION_MIN_CONFIDENCE", "0.75"))
        self.video_coverage_seconds = int(self.env.get("EVIDENCE_VIDEO_COVERAGE_SECONDS", "15"))
        self.video_max_frames = int(self.env.get("EVIDENCE_VIDEO_MAX_FRAMES", "60"))
        self.video_scene_threshold = float(self.env.get("EVIDENCE_VIDEO_SCENE_THRESHOLD", "0.2"))
        self.video_frame_batch_size = int(self.env.get("EVIDENCE_VIDEO_FRAME_BATCH_SIZE", "8"))
        self.codex_max_images = int(self.env.get("CODEX_SUBSCRIPTION_MAX_IMAGES", "8"))
        self.max_source_text_chars = int(self.env.get("EVIDENCE_SOURCE_MAX_TEXT_CHARS", "60000"))

    def run_once(self) -> bool:
        claimed = self._claim()
        if claimed is None:
            return False
        try:
            if claimed.kind == "source_interpretation":
                self._interpret_project_sources(claimed)
            elif claimed.kind == "cross_source_understanding":
                self._link_project_sources(claimed)
            else:
                raise SourceIntelligenceError("Unsupported source-intelligence job kind.")
            self._complete_job(claimed.job_id)
        except Exception as error:  # keep diagnostics server-side and retry bounded work
            self._retry_or_fail(claimed, error)
        return True

    def _required(self, name: str) -> str:
        value = self.env.get(name)
        if not value:
            raise SourceIntelligenceError(f"{name} is not configured for source intelligence.")
        return value

    def _claim(self) -> ClaimedPlatformJob | None:
        rows = self._request("/rest/v1/rpc/claim_source_intelligence_job", method="POST", body={})
        if not rows:
            return None
        row = rows[0]
        return ClaimedPlatformJob(
            job_id=str(row["job_id"]),
            attempts=int(row["attempts"]),
            project_id=str(row["project_id"]),
            kind=str(row["kind"]),
            payload=row.get("payload") if isinstance(row.get("payload"), dict) else {},
        )

    def _interpret_project_sources(self, job: ClaimedPlatformJob) -> None:
        self._ensure_model()
        artifacts = self._project_artifacts(job.project_id)
        requested = {str(value) for value in job.payload.get("evidenceIds", [])}
        for artifact in artifacts:
            extractions = self._artifact_extractions(artifact.id)
            if requested and not requested.intersection(item["id"] for item in extractions):
                continue
            with tempfile.TemporaryDirectory(prefix="tacit-source-") as temp:
                directory = Path(temp)
                images, extractions = self._visual_inputs(artifact, extractions, directory)
                batch_size = self.video_frame_batch_size
                if self.source_llm_backend == "codex_subscription":
                    batch_size = min(batch_size, self.codex_max_images)
                for batch in _batches(images, batch_size):
                    interpretation = self._interpret_source(artifact, extractions, batch, self.vision_detail)
                    if batch and (
                        interpretation["quality"]["needsHigherDetail"]
                        or interpretation["quality"]["confidence"] < self.minimum_confidence
                    ):
                        interpretation = self._interpret_source(
                            artifact, extractions, batch, self.vision_escalation_detail
                        )
                    self._save_interpretation(job.project_id, artifact.id, interpretation, extractions)

    def _link_project_sources(self, job: ClaimedPlatformJob) -> None:
        self._ensure_model()
        insights = self._request(
            f"/rest/v1/evidence_insights?project_id=eq.{job.project_id}&select=*&order=created_at.asc"
        )
        if len(insights) < 2:
            return
        source_ids = {str(row["id"]) for row in insights}
        extraction_ids = {
            str(item)
            for row in insights
            for item in (row.get("extraction_ids") if isinstance(row.get("extraction_ids"), list) else [])
        }
        # Preserve the full source set in storage, but bound one model request.
        compact = [
            {"id": row["id"], "kind": row["kind"], "content": row["content"], "extractionIds": row["extraction_ids"]}
            for row in insights[-160:]
        ]
        schema = {
            "type": "object",
            "additionalProperties": False,
            "required": ["relationships"],
            "properties": {
                "relationships": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["fromInsightId", "toInsightId", "type", "rationale", "extractionIds", "confidence"],
                        "properties": {
                            "fromInsightId": {"type": "string"},
                            "toInsightId": {"type": "string"},
                            "type": {"type": "string", "enum": ["supports", "contradicts", "references", "same_entity", "precedes"]},
                            "rationale": {"type": "string"},
                            "extractionIds": {"type": "array", "items": {"type": "string"}},
                            "confidence": {"type": "number"},
                        },
                    },
                }
            },
        }
        result = self._responses_json(
            "Link only material relationships between these source insights. Do not infer a relationship from shared vocabulary alone. Every relationship must cite the supporting extraction IDs supplied on the linked insights. Return an empty array if there is no durable support.\n\nInsights:\n"
            + json.dumps(compact),
            schema,
            [],
            self.vision_detail,
            purpose="cross_source_understanding",
        )
        rows = []
        for relationship in result.get("relationships", []):
            from_id, to_id = str(relationship.get("fromInsightId")), str(relationship.get("toInsightId"))
            ids = [str(value) for value in relationship.get("extractionIds", [])]
            if from_id == to_id or from_id not in source_ids or to_id not in source_ids:
                continue
            if not ids or any(value not in extraction_ids for value in ids):
                continue
            confidence = float(relationship.get("confidence", -1))
            if not 0 <= confidence <= 1:
                continue
            rows.append(
                {
                    "project_id": job.project_id,
                    "from_insight_id": from_id,
                    "to_insight_id": to_id,
                    "relationship_type": relationship.get("type"),
                    "rationale": str(relationship.get("rationale", "")).strip(),
                    "extraction_ids": ids,
                    "confidence": confidence,
                }
            )
        if rows:
            self._request("/rest/v1/evidence_relationships", method="POST", body=rows)

    def _project_artifacts(self, project_id: str) -> list[SourceArtifact]:
        rows = self._request(
            "/rest/v1/evidence_artifacts?project_id=eq."
            + project_id
            + "&status=eq.ready&scan_status=eq.clean&select=id,project_id,media_type,storage_key,storage_version,checksum_sha256"
        )
        return [
            SourceArtifact(
                id=str(row["id"]),
                project_id=str(row["project_id"]),
                media_type=str(row["media_type"]),
                storage_key=str(row["storage_key"]),
                storage_version=None if row.get("storage_version") is None else str(row["storage_version"]),
                checksum_sha256=str(row["checksum_sha256"]),
            )
            for row in rows
        ]

    def _artifact_extractions(self, artifact_id: str) -> list[dict[str, Any]]:
        return self._request(
            f"/rest/v1/evidence_extractions?artifact_id=eq.{artifact_id}&select=*&order=created_at.asc"
        )

    def _visual_inputs(
        self, artifact: SourceArtifact, extractions: list[dict[str, Any]], directory: Path
    ) -> tuple[list[tuple[str, Path, str]], list[dict[str, Any]]]:
        if not (artifact.media_type.startswith("image/") or artifact.media_type.startswith("video/")):
            return [], extractions
        source = directory / "source"
        self._download(artifact.storage_key, source)
        if artifact.media_type.startswith("image/"):
            citations = [str(item["id"]) for item in extractions]
            if not citations:
                citations = [self._save_visual_extraction(artifact, None, None)]
                extractions = self._artifact_extractions(artifact.id)
            media_type = _supported_image_media_type(artifact.media_type)
            return ([(citations[0], source, media_type)] if media_type else []), extractions
        try:
            duration = video_duration_ms(source)
            frames = sample_video_frames(
                source,
                directory / "frames",
                duration_ms=duration,
                coverage_seconds=self.video_coverage_seconds,
                max_frames=self.video_max_frames,
                scene_threshold=self.video_scene_threshold,
            )
        except VideoSamplingError as error:
            raise SourceIntelligenceError(str(error)) from error
        visual: list[tuple[str, Path, str]] = []
        for frame in frames:
            frame_id = _frame_extraction_id(extractions, frame.time_ms)
            if frame_id is None:
                frame_id = self._save_visual_extraction(
                    artifact,
                    frame.time_ms,
                    min(frame.time_ms + self.video_coverage_seconds * 1000, duration),
                    kind="frame",
                )
                extractions = self._artifact_extractions(artifact.id)
            visual.append((frame_id, frame.path, "image/jpeg"))
        return visual, extractions

    def _save_visual_extraction(
        self,
        artifact: SourceArtifact,
        start_ms: int | None,
        end_ms: int | None,
        *,
        kind: str = "visual",
    ) -> str:
        label = "Image source retained for multimodal interpretation." if start_ms is None else f"Video frame sampled at {start_ms / 1000:.3f}s for visual analysis."
        rows = self._request(
            "/rest/v1/evidence_extractions",
            method="POST",
            headers={"Prefer": "return=representation"},
            body=[
                {
                    "artifact_id": artifact.id,
                    "kind": kind,
                    "content": label,
                    "page_start": None,
                    "page_end": None,
                    "time_start_ms": start_ms,
                    "time_end_ms": end_ms,
                    "confidence": 1.0,
                    "source_artifact_version": artifact.storage_version or artifact.checksum_sha256,
                }
            ],
        )
        return str(rows[0]["id"])

    def _interpret_source(
        self,
        artifact: SourceArtifact,
        extractions: list[dict[str, Any]],
        images: list[tuple[str, Path, str]],
        detail: str,
    ) -> dict[str, Any]:
        records = [
            {
                "id": row["id"],
                "kind": row["kind"],
                "content": str(row["content"])[: self.max_source_text_chars],
                "pageStart": row.get("page_start"),
                "pageEnd": row.get("page_end"),
                "timeStartMs": row.get("time_start_ms"),
                "timeEndMs": row.get("time_end_ms"),
                "confidence": row["confidence"],
            }
            for row in extractions
        ]
        prompt = (
            "Interpret one scanned, immutable workflow source. Extract only evidence that is visible or stated in the supplied source records. "
            "For images and video frames, distinguish literal visible text from visual description and inference. OCR is a fallible supporting signal: correct it only when the pixels support the correction, preserve unclear text as uncertain, and never fabricate values. "
            "Describe systems, UI state, tables, decisions, actions, and entities when present. Every output object must cite one or more extraction IDs below.\n\n"
            f"Artifact media type: {artifact.media_type}\n"
            f"Citeable extractions:\n{json.dumps(records)}"
        )
        if images:
            prompt += (
                "\n\nScan-cleared visual pixels for the cited image/frame extractions are supplied with this request. "
                "Inspect them directly; do not treat OCR as authoritative when pixels disagree."
            )
        return self._responses_json(
            prompt, _source_interpretation_schema(), images, detail, purpose="source_intelligence"
        )

    def _responses_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        images: list[tuple[str, Path, str]],
        detail: str,
        *,
        purpose: str,
    ) -> dict[str, Any]:
        self._ensure_model()
        if self.source_llm_backend == "codex_subscription":
            return self._codex_subscription_json(prompt, schema, purpose, images, detail)
        content: list[dict[str, Any]] = [{"type": "input_text", "text": prompt}]
        for extraction_id, image, media_type in images:
            encoded = base64.b64encode(image.read_bytes()).decode("ascii")
            content.append({"type": "input_text", "text": f"The next image is citeable extraction {extraction_id}."})
            content.append({"type": "input_image", "image_url": f"data:{media_type};base64,{encoded}", "detail": detail})
        payload = {
            "model": self.vision_model,
            "store": False,
            "input": [{"role": "user", "content": content}],
            "text": {"format": {"type": "json_schema", "name": "tacit_source_intelligence", "strict": True, "schema": schema}},
        }
        request = Request("https://api.openai.com/v1/responses", data=json.dumps(payload).encode(), method="POST")
        request.add_header("Authorization", f"Bearer {self.openai_key}")
        request.add_header("Content-Type", "application/json")
        try:
            with urlopen(request, timeout=180) as response:
                output = json.loads(response.read().decode()).get("output_text")
        except (HTTPError, URLError, json.JSONDecodeError) as error:
            raise SourceIntelligenceError("Multimodal source interpretation failed safely.") from error
        if not output:
            raise SourceIntelligenceError("Multimodal source interpretation returned no output.")
        try:
            return json.loads(output)
        except json.JSONDecodeError as error:
            raise SourceIntelligenceError("Multimodal source interpretation returned invalid JSON.") from error

    def _codex_subscription_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        purpose: str,
        images: list[tuple[str, Path, str]],
        detail: str,
    ) -> dict[str, Any]:
        request_prompt = (
            f"{prompt}\n\nReturn only one JSON object. It must validate against this JSON Schema; "
            "do not use markdown or add commentary:\n"
            + json.dumps(schema, separators=(",", ":"))
        )
        request = Request(
            f"{self.codex_runner_url}/codex/generate",
            data=json.dumps(
                {
                    "purpose": purpose,
                    "prompt": request_prompt,
                    "detail": detail,
                    "images": [
                        {
                            "extractionId": extraction_id,
                            "mediaType": media_type,
                            "base64": base64.b64encode(image.read_bytes()).decode("ascii"),
                        }
                        for extraction_id, image, media_type in images
                    ],
                }
            ).encode(),
            method="POST",
        )
        request.add_header("X-Tacit-Codex-Runner-Secret", str(self.codex_runner_secret))
        request.add_header("Content-Type", "application/json")
        try:
            with urlopen(request, timeout=180) as response:
                output = json.loads(response.read().decode()).get("output")
        except (HTTPError, URLError, json.JSONDecodeError) as error:
            raise SourceIntelligenceError("Codex subscription source interpretation failed safely.") from error
        if not isinstance(output, str) or not output.strip():
            raise SourceIntelligenceError("Codex subscription source interpretation returned no output.")
        try:
            return json.loads(output)
        except json.JSONDecodeError as error:
            raise SourceIntelligenceError("Codex subscription source interpretation returned invalid JSON.") from error

    def _save_interpretation(
        self, project_id: str, artifact_id: str, result: dict[str, Any], extractions: list[dict[str, Any]]
    ) -> None:
        allowed = {str(row["id"]) for row in extractions}
        rows: list[dict[str, Any]] = []
        source_class = str(result.get("sourceClass", "other"))
        for kind, value in (
            ("source_classification", {"content": source_class, **result.get("classification", {})}),
            ("summary", result.get("summary", {})),
        ):
            row = self._insight_row(project_id, artifact_id, kind, value, allowed)
            if row:
                rows.append(row)
        for kind, values in (
            ("entity", result.get("entities", [])),
            ("fact", result.get("facts", [])),
            ("table_structure", result.get("tableStructures", [])),
            ("system_context", result.get("systemContexts", [])),
        ):
            for value in values:
                row = self._insight_row(project_id, artifact_id, kind, value, allowed)
                if row:
                    rows.append(row)
        if not rows:
            raise SourceIntelligenceError("Multimodal source interpretation did not return cited facts.")
        self._request("/rest/v1/evidence_insights", method="POST", body=rows)

    def _insight_row(
        self, project_id: str, artifact_id: str, kind: str, value: Any, allowed: set[str]
    ) -> dict[str, Any] | None:
        if not isinstance(value, dict):
            return None
        content = str(value.get("content") or value.get("statement") or "").strip()
        ids = [str(item) for item in value.get("extractionIds", [])]
        confidence = float(value.get("confidence", -1))
        if not content or not ids or any(item not in allowed for item in ids) or not 0 <= confidence <= 1:
            return None
        return {
            "project_id": project_id,
            "artifact_id": artifact_id,
            "kind": kind,
            "content": content,
            "entity_type": str(value.get("type")).strip() if kind == "entity" and value.get("type") else None,
            "entity_value": str(value.get("value")).strip() if kind == "entity" and value.get("value") else None,
            "confidence": confidence,
            "extraction_ids": ids,
            "model_role": "source_interpretation",
            "model_version": self._model_version(),
        }

    def _download(self, storage_key: str, destination: Path) -> None:
        request = Request(f"{self.supabase_url}/storage/v1/object/tacit-artifacts/{storage_key}")
        request.add_header("apikey", self.service_key)
        request.add_header("Authorization", f"Bearer {self.service_key}")
        try:
            with urlopen(request, timeout=120) as response, destination.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
        except HTTPError as error:
            raise SourceIntelligenceError("A scan-cleared source could not be downloaded.") from error

    def _complete_job(self, job_id: str) -> None:
        now = _now()
        self._request(
            f"/rest/v1/platform_jobs?id=eq.{job_id}",
            method="PATCH",
            body={"status": "succeeded", "completed_at": now, "updated_at": now, "error_message": None},
        )

    def _retry_or_fail(self, job: ClaimedPlatformJob, error: Exception) -> None:
        now = _now()
        failure = str(error) or "Source intelligence failed safely."
        if job.attempts >= 5:
            value = {"status": "failed", "completed_at": now, "updated_at": now, "error_message": failure[:500]}
        else:
            retry_at = (datetime.now(UTC) + timedelta(seconds=30 * job.attempts)).isoformat()
            value = {"status": "queued", "available_at": retry_at, "updated_at": now, "error_message": failure[:500]}
        self._request(f"/rest/v1/platform_jobs?id=eq.{job.job_id}", method="PATCH", body=value)

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        body: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        payload = None if body is None else json.dumps(body).encode()
        request = Request(f"{self.supabase_url}{path}", data=payload, method=method)
        request.add_header("apikey", self.service_key)
        request.add_header("Authorization", f"Bearer {self.service_key}")
        if payload is not None:
            request.add_header("Content-Type", "application/json")
        for key, value in (headers or {}).items():
            request.add_header(key, value)
        try:
            with urlopen(request, timeout=45) as response:
                raw = response.read()
                return json.loads(raw.decode()) if raw else None
        except HTTPError as error:
            raise SourceIntelligenceError(f"Source-intelligence persistence failed ({error.code}).") from error

    def _ensure_model(self) -> None:
        if self.source_llm_backend == "codex_subscription":
            if not self.codex_runner_url or not self.codex_runner_secret or not self.codex_subscription_model:
                raise SourceIntelligenceError("Codex subscription source intelligence is not configured.")
            return
        if self.source_llm_backend != "openai_api":
            raise SourceIntelligenceError("Unsupported source-intelligence LLM backend.")
        if not self.openai_key or not self.vision_model:
            raise SourceIntelligenceError("Vision source intelligence is not configured.")

    def _model_version(self) -> str:
        if self.source_llm_backend == "codex_subscription":
            return str(self.codex_subscription_model)
        return str(self.vision_model)


def _source_interpretation_schema() -> dict[str, Any]:
    citation = {"type": "array", "minItems": 1, "items": {"type": "string"}}
    item = {
        "type": "object",
        "additionalProperties": False,
        "required": ["content", "confidence", "extractionIds"],
        "properties": {"content": {"type": "string"}, "confidence": {"type": "number"}, "extractionIds": citation},
    }
    entity = {
        "type": "object",
        "additionalProperties": False,
        "required": ["content", "type", "value", "confidence", "extractionIds"],
        "properties": {**item["properties"], "type": {"type": "string"}, "value": {"type": "string"}},
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["sourceClass", "classification", "summary", "entities", "facts", "tableStructures", "systemContexts", "quality"],
        "properties": {
            "sourceClass": {"type": "string", "enum": ["policy", "record", "spreadsheet", "screen", "conversation", "recording", "other"]},
            "classification": item,
            "summary": item,
            "entities": {"type": "array", "items": entity},
            "facts": {"type": "array", "items": item},
            "tableStructures": {"type": "array", "items": item},
            "systemContexts": {"type": "array", "items": item},
            "quality": {"type": "object", "additionalProperties": False, "required": ["confidence", "needsHigherDetail"], "properties": {"confidence": {"type": "number"}, "needsHigherDetail": {"type": "boolean"}}},
        },
    }


def _frame_extraction_id(extractions: list[dict[str, Any]], time_ms: int) -> str | None:
    for row in extractions:
        if row.get("kind") == "frame" and int(row.get("time_start_ms") or -1) == time_ms:
            return str(row["id"])
    return None


def _supported_image_media_type(media_type: str) -> str | None:
    return media_type if media_type in {"image/jpeg", "image/png", "image/webp"} else None


def _batches(values: list[tuple[str, Path, str]], size: int) -> list[list[tuple[str, Path, str]]]:
    return [values[index : index + size] for index in range(0, len(values), max(1, size))] or [[]]


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
