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
            elif claimed.kind == "package_synthesis":
                self._synthesize_package(claimed)
            else:
                raise SourceIntelligenceError("Unsupported source-intelligence job kind.")
            self._complete_job(claimed)
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
        interpreted = self._interpreted_artifact_ids(job.project_id)
        for artifact in artifacts:
            # Artifacts are immutable for the lifetime of their extraction IDs. A
            # stored summary is a completed checkpoint, so retries resume with only
            # unfinished sources instead of duplicating completed insight rows.
            if artifact.id in interpreted:
                continue
            extractions = self._artifact_extractions(artifact.id)
            # OCR can legitimately produce no text for a scan-cleared image. Let
            # the visual branch create its durable citation anchor before deciding
            # whether the artifact belongs in this source-understanding pass.
            if not self._should_interpret_artifact(artifact, extractions, requested):
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

    def _interpreted_artifact_ids(self, project_id: str) -> set[str]:
        rows = self._request(
            "/rest/v1/evidence_insights?project_id=eq."
            + project_id
            + "&kind=eq.summary&select=artifact_id"
        )
        return {str(row["artifact_id"]) for row in rows if row.get("artifact_id")}

    @staticmethod
    def _should_interpret_artifact(
        artifact: SourceArtifact, extractions: list[dict[str, Any]], requested: set[str]
    ) -> bool:
        if not requested or requested.intersection(str(item["id"]) for item in extractions):
            return True
        return artifact.media_type.startswith("image/") or artifact.media_type.startswith("video/")

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

    def _synthesize_package(self, job: ClaimedPlatformJob) -> None:
        """Assemble a domain-agnostic process draft from all cited source insights.

        Package-level insights are project-scoped (artifact_id is null). They never
        invent extraction IDs: every claim must reuse IDs already present on the
        contributing source insights so reconstruction can cite durable evidence.
        """
        self._ensure_model()
        insights = self._request(
            f"/rest/v1/evidence_insights?project_id=eq.{job.project_id}&select=*&order=created_at.asc"
        )
        if not insights:
            return
        # Retry-safe checkpoint: a prior successful synthesis for this package left
        # package_* rows. Replacing them keeps one coherent draft per project run.
        self._clear_package_insights(job.project_id)
        extraction_ids = {
            str(item)
            for row in insights
            for item in (row.get("extraction_ids") if isinstance(row.get("extraction_ids"), list) else [])
        }
        if not extraction_ids:
            raise SourceIntelligenceError("Package synthesis requires cited source insights.")
        compact = _compact_insights_for_synthesis(insights)
        result = self._responses_json(
            (
                "Synthesize one domain-agnostic knowledge-transfer package from the cited source insights. "
                "Do not invent process knowledge. Prefer policy/source_role=policy for rules and thresholds; "
                "prefer case_record for primary case facts; use operational_register for patterns; "
                "use expert_walkthrough for unwritten judgment and approval boundaries. "
                "Every output object must cite only extraction IDs already present on the supplied insights. "
                "Order suggestedSteps as a practical reviewer would work the case. "
                "Leave arrays empty when unsupported. Never invent connectors, systems, or outcomes.\n\n"
                f"Source insights:\n{json.dumps(compact)}"
            ),
            _package_synthesis_schema(),
            [],
            self.vision_detail,
            purpose="package_synthesis",
        )
        self._save_package_synthesis(job.project_id, result, extraction_ids)

    def _clear_package_insights(self, project_id: str) -> None:
        kinds = ",".join(PACKAGE_INSIGHT_KINDS)
        self._request(
            f"/rest/v1/evidence_insights?project_id=eq.{project_id}&kind=in.({kinds})",
            method="DELETE",
        )

    def _save_package_synthesis(
        self, project_id: str, result: dict[str, Any], allowed: set[str]
    ) -> None:
        rows: list[dict[str, Any]] = []
        for kind, value in (
            ("package_objective", result.get("processObjective")),
            ("package_primary_case", result.get("primaryCase")),
        ):
            row = self._package_insight_row(project_id, kind, value, allowed)
            if row:
                rows.append(row)
        for kind, values in (
            ("package_policy_rule", result.get("policyRules", [])),
            ("package_case_fact", result.get("caseFacts", [])),
            ("package_suggested_step", result.get("suggestedSteps", [])),
            ("package_missing", result.get("missingForAutomation", [])),
            ("package_never_automate", result.get("neverAutomate", [])),
            ("package_contradiction", result.get("contradictions", [])),
        ):
            if not isinstance(values, list):
                continue
            for value in values:
                row = self._package_insight_row(project_id, kind, value, allowed)
                if row:
                    rows.append(row)
        if not rows:
            raise SourceIntelligenceError("Package synthesis did not return cited process structure.")
        self._request("/rest/v1/evidence_insights", method="POST", body=rows)

    def _package_insight_row(
        self, project_id: str, kind: str, value: Any, allowed: set[str]
    ) -> dict[str, Any] | None:
        if not isinstance(value, dict):
            return None
        content = str(
            value.get("content")
            or value.get("statement")
            or value.get("description")
            or value.get("name")
            or ""
        ).strip()
        ids = [str(item) for item in value.get("extractionIds", [])]
        confidence = float(value.get("confidence", -1))
        if not content or not ids or any(item not in allowed for item in ids) or not 0 <= confidence <= 1:
            return None
        entity_type = None
        entity_value = None
        if kind == "package_suggested_step":
            entity_type = str(value.get("kind") or value.get("type") or "action").strip() or "action"
            order = value.get("orderHint")
            name = str(value.get("name") or "").strip()
            entity_value = name or (str(int(order)) if isinstance(order, (int, float)) else None)
        elif kind == "package_policy_rule":
            entity_type = "policy_rule"
            entity_value = str(value.get("name") or "").strip() or None
            condition = str(value.get("condition") or "").strip()
            action = str(value.get("action") or "").strip()
            if condition and action:
                content = f"{condition} → {action}"
            elif condition or action:
                content = condition or action
        elif kind == "package_case_fact":
            entity_type = "case_field"
            name = str(value.get("name") or value.get("field") or "").strip()
            field_value = str(value.get("value") or "").strip()
            entity_value = name or None
            if name and field_value:
                content = f"{name} = {field_value}"
            elif field_value:
                content = field_value
        elif kind == "package_contradiction":
            entity_type = "contradiction"
            entity_value = str(value.get("severity") or "").strip() or None
        return {
            "project_id": project_id,
            "artifact_id": None,
            "kind": kind,
            "content": content,
            "entity_type": entity_type,
            "entity_value": entity_value,
            "confidence": confidence,
            "extraction_ids": ids,
            "model_role": "package_synthesis",
            "model_version": self._model_version(),
        }

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
            # Prefer an explicit visual citation; otherwise use any extraction as the handle,
            # or create a visual anchor when ingestion produced nothing citeable.
            preferred = [item for item in extractions if item.get("kind") == "visual"]
            citations = [str(item["id"]) for item in (preferred or extractions)]
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
            "Interpret one scanned, immutable workflow source in a domain-agnostic way. "
            "Extract only evidence that is visible or stated in the supplied source records. "
            "For images and video frames, distinguish literal visible text from visual description and inference. "
            "OCR is a fallible supporting signal: correct it only when the pixels support the correction, "
            "preserve unclear text as uncertain, and never fabricate values. "
            "Classify the source role (policy, case_record, operational_register, expert_walkthrough, system_screenshot, other). "
            "When present, extract process structure: objective, ordered steps, decisions with conditions/actions, "
            "numeric or categorical thresholds, actors/roles, exceptions, never-automate boundaries, and case field values. "
            "Leave process arrays empty when the source does not support them. "
            "Describe systems, UI state, tables, and entities when present. "
            "Every output object must cite one or more extraction IDs below.\n\n"
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
        source_role = str(result.get("sourceRole") or result.get("sourceClass") or "other")
        classification = result.get("classification") if isinstance(result.get("classification"), dict) else {}
        summary = result.get("summary") if isinstance(result.get("summary"), dict) else {}
        quality = result.get("quality") if isinstance(result.get("quality"), dict) else {}
        role_citations = classification.get("extractionIds") or summary.get("extractionIds") or []
        for kind, value in (
            ("source_classification", {"content": source_class, **classification}),
            (
                "source_role",
                {
                    "content": source_role,
                    "confidence": classification.get("confidence", quality.get("confidence", 0.5)),
                    "extractionIds": role_citations,
                },
            ),
            ("summary", summary),
            ("process_objective", result.get("processObjective")),
        ):
            row = self._insight_row(project_id, artifact_id, kind, value, allowed)
            if row:
                rows.append(row)
        for kind, values in (
            ("entity", result.get("entities", [])),
            ("fact", result.get("facts", [])),
            ("table_structure", result.get("tableStructures", [])),
            ("system_context", result.get("systemContexts", [])),
            ("actor", result.get("actors", [])),
            ("process_step", result.get("processSteps", [])),
            ("process_decision", result.get("decisions", [])),
            ("threshold", result.get("thresholds", [])),
            ("case_field", result.get("caseFields", [])),
            ("exception", result.get("exceptions", [])),
            ("never_automate", result.get("neverAutomate", [])),
        ):
            if not isinstance(values, list):
                continue
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
        content = str(value.get("content") or value.get("statement") or value.get("description") or "").strip()
        ids = [str(item) for item in value.get("extractionIds", [])]
        confidence = float(value.get("confidence", -1))
        if not content or not ids or any(item not in allowed for item in ids) or not 0 <= confidence <= 1:
            # Structured process objects may encode content across fields.
            content, ids, confidence, entity_type, entity_value = _normalize_process_insight(kind, value, allowed)
            if not content or not ids or not 0 <= confidence <= 1:
                return None
        else:
            entity_type, entity_value = _entity_fields_for_kind(kind, value)
        return {
            "project_id": project_id,
            "artifact_id": artifact_id,
            "kind": kind,
            "content": content,
            "entity_type": entity_type,
            "entity_value": entity_value,
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

    def _complete_job(self, job: ClaimedPlatformJob) -> None:
        now = _now()
        self._request(
            f"/rest/v1/platform_jobs?id=eq.{job.job_id}",
            method="PATCH",
            body={"status": "succeeded", "completed_at": now, "updated_at": now, "error_message": None},
        )
        self._update_attempt(job, "succeeded", now)

    def _retry_or_fail(self, job: ClaimedPlatformJob, error: Exception) -> None:
        now = _now()
        failure = str(error) or "Source intelligence failed safely."
        if job.attempts >= 5:
            value = {"status": "failed", "completed_at": now, "updated_at": now, "error_message": failure[:500]}
            attempt_status = "failed"
        else:
            retry_at = (datetime.now(UTC) + timedelta(seconds=30 * job.attempts)).isoformat()
            value = {"status": "queued", "available_at": retry_at, "updated_at": now, "error_message": failure[:500]}
            attempt_status = "retrying"
        self._request(f"/rest/v1/platform_jobs?id=eq.{job.job_id}", method="PATCH", body=value)
        self._update_attempt(job, attempt_status, now, failure[:500])

    def _update_attempt(
        self, job: ClaimedPlatformJob, status: str, completed_at: str, error_message: str | None = None
    ) -> None:
        self._request(
            f"/rest/v1/platform_job_attempts?job_id=eq.{job.job_id}&attempt=eq.{job.attempts}",
            method="PATCH",
            body={"status": status, "completed_at": completed_at, "error_message": error_message},
        )

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


PACKAGE_INSIGHT_KINDS = (
    "package_objective",
    "package_primary_case",
    "package_policy_rule",
    "package_case_fact",
    "package_suggested_step",
    "package_missing",
    "package_never_automate",
    "package_contradiction",
)

PROCESS_INSIGHT_PRIORITY = {
    "package_objective": 0,
    "package_primary_case": 0,
    "package_policy_rule": 0,
    "package_case_fact": 0,
    "package_suggested_step": 0,
    "package_missing": 0,
    "package_never_automate": 0,
    "package_contradiction": 0,
    "source_role": 1,
    "process_objective": 1,
    "process_step": 1,
    "process_decision": 1,
    "threshold": 1,
    "actor": 1,
    "exception": 1,
    "never_automate": 1,
    "case_field": 1,
    "summary": 2,
    "source_classification": 2,
    "fact": 3,
    "entity": 3,
    "table_structure": 4,
    "system_context": 4,
}


def _citation_schema() -> dict[str, Any]:
    return {"type": "array", "minItems": 1, "items": {"type": "string"}}


def _cited_item_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["content", "confidence", "extractionIds"],
        "properties": {
            "content": {"type": "string"},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }


def _source_interpretation_schema() -> dict[str, Any]:
    item = _cited_item_schema()
    entity = {
        "type": "object",
        "additionalProperties": False,
        "required": ["content", "type", "value", "confidence", "extractionIds"],
        "properties": {**item["properties"], "type": {"type": "string"}, "value": {"type": "string"}},
    }
    actor = {
        "type": "object",
        "additionalProperties": False,
        "required": ["content", "role", "confidence", "extractionIds"],
        "properties": {
            "content": {"type": "string"},
            "role": {"type": "string"},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    process_step = {
        "type": "object",
        "additionalProperties": False,
        "required": ["name", "description", "kind", "orderHint", "confidence", "extractionIds"],
        "properties": {
            "name": {"type": "string"},
            "description": {"type": "string"},
            "kind": {
                "type": "string",
                "enum": ["check", "decision", "action", "approval", "escalation", "other"],
            },
            "orderHint": {"type": "integer"},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    decision = {
        "type": "object",
        "additionalProperties": False,
        "required": ["name", "condition", "action", "risk", "confidence", "extractionIds"],
        "properties": {
            "name": {"type": "string"},
            "condition": {"type": "string"},
            "action": {"type": "string"},
            "risk": {"type": "string", "enum": ["low", "medium", "high"]},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    threshold = {
        "type": "object",
        "additionalProperties": False,
        "required": ["name", "value", "unit", "confidence", "extractionIds"],
        "properties": {
            "name": {"type": "string"},
            "value": {"type": "string"},
            "unit": {"type": "string"},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    case_field = {
        "type": "object",
        "additionalProperties": False,
        "required": ["name", "value", "confidence", "extractionIds"],
        "properties": {
            "name": {"type": "string"},
            "value": {"type": "string"},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "sourceClass",
            "sourceRole",
            "classification",
            "summary",
            "processObjective",
            "entities",
            "facts",
            "tableStructures",
            "systemContexts",
            "actors",
            "processSteps",
            "decisions",
            "thresholds",
            "caseFields",
            "exceptions",
            "neverAutomate",
            "quality",
        ],
        "properties": {
            "sourceClass": {
                "type": "string",
                "enum": ["policy", "record", "spreadsheet", "screen", "conversation", "recording", "other"],
            },
            "sourceRole": {
                "type": "string",
                "enum": [
                    "policy",
                    "case_record",
                    "operational_register",
                    "expert_walkthrough",
                    "system_screenshot",
                    "other",
                ],
            },
            "classification": item,
            "summary": item,
            "processObjective": item,
            "entities": {"type": "array", "items": entity},
            "facts": {"type": "array", "items": item},
            "tableStructures": {"type": "array", "items": item},
            "systemContexts": {"type": "array", "items": item},
            "actors": {"type": "array", "items": actor},
            "processSteps": {"type": "array", "items": process_step},
            "decisions": {"type": "array", "items": decision},
            "thresholds": {"type": "array", "items": threshold},
            "caseFields": {"type": "array", "items": case_field},
            "exceptions": {"type": "array", "items": item},
            "neverAutomate": {"type": "array", "items": item},
            "quality": {
                "type": "object",
                "additionalProperties": False,
                "required": ["confidence", "needsHigherDetail"],
                "properties": {
                    "confidence": {"type": "number"},
                    "needsHigherDetail": {"type": "boolean"},
                },
            },
        },
    }


def _package_synthesis_schema() -> dict[str, Any]:
    item = _cited_item_schema()
    policy_rule = {
        "type": "object",
        "additionalProperties": False,
        "required": ["name", "condition", "action", "risk", "confidence", "extractionIds"],
        "properties": {
            "name": {"type": "string"},
            "condition": {"type": "string"},
            "action": {"type": "string"},
            "risk": {"type": "string", "enum": ["low", "medium", "high"]},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    case_fact = {
        "type": "object",
        "additionalProperties": False,
        "required": ["name", "value", "confidence", "extractionIds"],
        "properties": {
            "name": {"type": "string"},
            "value": {"type": "string"},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    suggested_step = {
        "type": "object",
        "additionalProperties": False,
        "required": ["name", "description", "kind", "orderHint", "confidence", "extractionIds"],
        "properties": {
            "name": {"type": "string"},
            "description": {"type": "string"},
            "kind": {
                "type": "string",
                "enum": ["check", "decision", "action", "approval", "escalation", "other"],
            },
            "orderHint": {"type": "integer"},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    contradiction = {
        "type": "object",
        "additionalProperties": False,
        "required": ["content", "severity", "confidence", "extractionIds"],
        "properties": {
            "content": {"type": "string"},
            "severity": {"type": "string", "enum": ["low", "medium", "high"]},
            "confidence": {"type": "number"},
            "extractionIds": _citation_schema(),
        },
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "processObjective",
            "primaryCase",
            "policyRules",
            "caseFacts",
            "suggestedSteps",
            "missingForAutomation",
            "neverAutomate",
            "contradictions",
        ],
        "properties": {
            "processObjective": item,
            "primaryCase": item,
            "policyRules": {"type": "array", "items": policy_rule},
            "caseFacts": {"type": "array", "items": case_fact},
            "suggestedSteps": {"type": "array", "items": suggested_step},
            "missingForAutomation": {"type": "array", "items": item},
            "neverAutomate": {"type": "array", "items": item},
            "contradictions": {"type": "array", "items": contradiction},
        },
    }


def _compact_insights_for_synthesis(insights: list[dict[str, Any]], limit: int = 200) -> list[dict[str, Any]]:
    ranked = sorted(
        insights,
        key=lambda row: (
            PROCESS_INSIGHT_PRIORITY.get(str(row.get("kind")), 5),
            str(row.get("created_at") or ""),
        ),
    )
    compact: list[dict[str, Any]] = []
    for row in ranked[:limit]:
        compact.append(
            {
                "id": row.get("id"),
                "kind": row.get("kind"),
                "content": row.get("content"),
                "entityType": row.get("entity_type"),
                "entityValue": row.get("entity_value"),
                "extractionIds": row.get("extraction_ids"),
                "confidence": row.get("confidence"),
                "artifactId": row.get("artifact_id"),
            }
        )
    return compact


def _entity_fields_for_kind(kind: str, value: dict[str, Any]) -> tuple[str | None, str | None]:
    if kind == "entity":
        entity_type = str(value.get("type")).strip() if value.get("type") else None
        entity_value = str(value.get("value")).strip() if value.get("value") else None
        return entity_type, entity_value
    if kind == "actor":
        role = str(value.get("role") or value.get("type") or "").strip() or None
        return "actor", role
    if kind == "process_step":
        return (
            str(value.get("kind") or "other").strip() or "other",
            str(value.get("name") or value.get("orderHint") or "").strip() or None,
        )
    if kind == "process_decision":
        return "decision", str(value.get("name") or "").strip() or None
    if kind == "threshold":
        return "threshold", str(value.get("name") or "").strip() or None
    if kind == "case_field":
        return "case_field", str(value.get("name") or "").strip() or None
    if kind in {"source_role", "source_classification"}:
        return kind, str(value.get("content") or "").strip() or None
    return None, None


def _normalize_process_insight(
    kind: str, value: dict[str, Any], allowed: set[str]
) -> tuple[str, list[str], float, str | None, str | None]:
    ids = [str(item) for item in value.get("extractionIds", []) if str(item) in allowed]
    try:
        confidence = float(value.get("confidence", -1))
    except (TypeError, ValueError):
        confidence = -1
    if kind == "process_step":
        name = str(value.get("name") or "").strip()
        description = str(value.get("description") or value.get("content") or "").strip()
        content = description or name
        if name and description and name not in description:
            content = f"{name}: {description}"
        return content, ids, confidence, *_entity_fields_for_kind(kind, value)
    if kind == "process_decision":
        name = str(value.get("name") or "").strip()
        condition = str(value.get("condition") or "").strip()
        action = str(value.get("action") or "").strip()
        if condition and action:
            content = f"{condition} → {action}"
        else:
            content = condition or action or name
        if name and content and name not in content:
            content = f"{name}: {content}"
        return content, ids, confidence, *_entity_fields_for_kind(kind, value)
    if kind == "threshold":
        name = str(value.get("name") or "").strip()
        amount = str(value.get("value") or "").strip()
        unit = str(value.get("unit") or "").strip()
        parts = [part for part in (name, amount, unit) if part]
        content = " ".join(parts) if parts else str(value.get("content") or "").strip()
        return content, ids, confidence, *_entity_fields_for_kind(kind, value)
    if kind == "case_field":
        name = str(value.get("name") or "").strip()
        field_value = str(value.get("value") or "").strip()
        content = f"{name} = {field_value}" if name and field_value else (field_value or name)
        return content, ids, confidence, *_entity_fields_for_kind(kind, value)
    if kind == "actor":
        role = str(value.get("role") or "").strip()
        content = str(value.get("content") or role).strip()
        return content, ids, confidence, *_entity_fields_for_kind(kind, value)
    content = str(value.get("content") or value.get("statement") or value.get("description") or "").strip()
    return content, ids, confidence, *_entity_fields_for_kind(kind, value)


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
