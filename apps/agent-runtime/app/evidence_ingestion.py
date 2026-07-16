from __future__ import annotations

import csv
import json
import os
import socket
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class IngestionError(Exception):
    """A safe, retryable ingestion failure."""


class MaliciousUploadError(IngestionError):
    """The configured malware scanner rejected an upload."""


@dataclass(frozen=True)
class ClaimedJob:
    job_id: str
    attempts: int
    artifact_id: str
    project_id: str
    organization_id: str
    evidence_type: str
    filename: str
    media_type: str
    storage_key: str
    storage_version: str | None
    checksum_sha256: str


class EvidenceIngestionWorker:
    def __init__(self, environment: dict[str, str] | None = None) -> None:
        self.env = environment or dict(os.environ)
        self.supabase_url = self._required("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
        self.service_key = self._required("SUPABASE_SERVICE_ROLE_KEY")
        self.clamav_host = self.env.get("CLAMAV_HOST", "clamav")
        self.clamav_port = int(self.env.get("CLAMAV_PORT", "3310"))
        self.transcription_model = self.env.get("EVIDENCE_TRANSCRIPTION_MODEL")
        self.openai_key = self.env.get("OPENAI_API_KEY")

    def _required(self, name: str) -> str:
        value = self.env.get(name)
        if not value:
            raise IngestionError(f"{name} is not configured for evidence ingestion.")
        return value

    def run_once(self) -> bool:
        self._purge_expired()
        claimed = self._claim()
        if claimed is None:
            return False
        try:
            with tempfile.TemporaryDirectory(prefix="tacit-evidence-") as directory:
                source = Path(directory) / "source"
                self._download(claimed.storage_key, source)
                self._scan(source)
                self._update_artifact(
                    claimed.artifact_id,
                    {"status": "processing", "scan_status": "clean", "failure_reason": None},
                )
                extractions = self._extract(claimed, source, Path(directory))
                self._save_extractions(claimed, extractions)
            self._update_artifact(
                claimed.artifact_id,
                {"status": "ready", "scan_status": "clean", "failure_reason": None},
            )
            self._complete_job(claimed.job_id, "succeeded")
        except MaliciousUploadError as error:
            self._update_artifact(
                claimed.artifact_id,
                {"status": "failed", "scan_status": "blocked", "failure_reason": str(error)},
            )
            self._complete_job(claimed.job_id, "failed", "malware_detected", str(error))
        except Exception as error:  # Worker errors are made retryable and never leak to customers.
            self._retry_or_fail(claimed, error)
        return True

    def _purge_expired(self) -> None:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        artifacts = self._request(
            f"/rest/v1/evidence_artifacts?retention_expires_at=lt.{now}&status=neq.deleted&select=id,storage_key"
        )
        for artifact in artifacts:
            self._request(
                "/storage/v1/object/tacit-artifacts",
                method="DELETE",
                body={"prefixes": [artifact["storage_key"]]},
            )
            self._request(
                f"/rest/v1/evidence_artifacts?id=eq.{artifact['id']}",
                method="PATCH",
                body={"status": "deleted", "deleted_at": now, "updated_at": now},
            )
            self._request(
                f"/rest/v1/evidence_ingestion_jobs?artifact_id=eq.{artifact['id']}&status=in.(queued,running)",
                method="PATCH",
                body={"status": "cancelled", "completed_at": now, "updated_at": now},
            )

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        body: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        payload = None if body is None else json.dumps(body).encode("utf-8")
        request = Request(f"{self.supabase_url}{path}", data=payload, method=method)
        request.add_header("apikey", self.service_key)
        request.add_header("Authorization", f"Bearer {self.service_key}")
        if payload is not None:
            request.add_header("Content-Type", "application/json")
        for key, value in (headers or {}).items():
            request.add_header(key, value)
        try:
            with urlopen(request, timeout=45) as response:
                return (
                    json.loads(response.read().decode("utf-8"))
                    if response.headers.get("content-type", "").startswith("application/json")
                    else response.read()
                )
        except HTTPError as error:
            raise IngestionError(f"Evidence persistence request failed ({error.code}).") from error

    def _claim(self) -> ClaimedJob | None:
        rows = self._request("/rest/v1/rpc/claim_evidence_ingestion_job", method="POST", body={})
        if not rows:
            return None
        row = rows[0]
        return ClaimedJob(**row)

    def _download(self, storage_key: str, destination: Path) -> None:
        request = Request(
            f"{self.supabase_url}/storage/v1/object/tacit-artifacts/{'/'.join(storage_key.split('/'))}"
        )
        request.add_header("apikey", self.service_key)
        request.add_header("Authorization", f"Bearer {self.service_key}")
        try:
            with urlopen(request, timeout=120) as response, destination.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
        except HTTPError as error:
            raise IngestionError(
                f"Evidence source could not be downloaded ({error.code})."
            ) from error

    def _scan(self, source: Path) -> None:
        try:
            with (
                socket.create_connection(
                    (self.clamav_host, self.clamav_port), timeout=15
                ) as connection,
                source.open("rb") as uploaded,
            ):
                connection.sendall(b"zINSTREAM\0")
                while chunk := uploaded.read(1024 * 1024):
                    connection.sendall(len(chunk).to_bytes(4, "big") + chunk)
                connection.sendall((0).to_bytes(4, "big"))
                response = connection.recv(4096).decode("utf-8", errors="replace")
        except OSError as error:
            raise IngestionError(
                "Malware scanner is unavailable; evidence was not processed."
            ) from error
        if "FOUND" in response:
            raise MaliciousUploadError("Malware scanner rejected this upload.")
        if "OK" not in response:
            raise IngestionError("Malware scanner returned an invalid result.")

    def _extract(self, job: ClaimedJob, source: Path, directory: Path) -> list[dict[str, Any]]:
        if job.media_type in {"text/plain", "text/markdown"}:
            return [
                {
                    "kind": "text",
                    "content": source.read_text(encoding="utf-8", errors="replace"),
                    "page_start": None,
                    "page_end": None,
                    "time_start_ms": None,
                    "time_end_ms": None,
                    "confidence": 1.0,
                }
            ]
        if job.media_type in {"text/csv", "application/csv"}:
            return self._extract_csv(source)
        if job.media_type == "application/pdf":
            return self._extract_pdf(source)
        if (
            job.media_type
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ):
            return self._extract_docx(source)
        if job.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return self._extract_xlsx(source)
        if job.media_type.startswith("image/"):
            return self._extract_image(source, None, None)
        if job.media_type.startswith("audio/"):
            return self._extract_audio(source, 0, self._duration_ms(source))
        if job.media_type.startswith("video/"):
            return self._extract_video(source, directory)
        raise IngestionError("No extractor is configured for this validated media type.")

    def _extract_pdf(self, source: Path) -> list[dict[str, Any]]:
        from pypdf import PdfReader

        return [
            {
                "kind": "text",
                "content": page.extract_text().strip(),
                "page_start": index,
                "page_end": index,
                "time_start_ms": None,
                "time_end_ms": None,
                "confidence": 0.96,
            }
            for index, page in enumerate(PdfReader(str(source)).pages, start=1)
            if page.extract_text().strip()
        ]

    def _extract_docx(self, source: Path) -> list[dict[str, Any]]:
        from docx import Document

        content = "\n".join(
            paragraph.text
            for paragraph in Document(str(source)).paragraphs
            if paragraph.text.strip()
        )
        return (
            [
                {
                    "kind": "text",
                    "content": content,
                    "page_start": None,
                    "page_end": None,
                    "time_start_ms": None,
                    "time_end_ms": None,
                    "confidence": 0.94,
                }
            ]
            if content
            else []
        )

    def _extract_csv(self, source: Path) -> list[dict[str, Any]]:
        with source.open(encoding="utf-8-sig", newline="") as file:
            rows = list(csv.reader(file))
        content = "\n".join(
            ", ".join(cell.strip() for cell in row)
            for row in rows
            if any(cell.strip() for cell in row)
        )
        return (
            [
                {
                    "kind": "spreadsheet",
                    "content": content,
                    "page_start": None,
                    "page_end": None,
                    "time_start_ms": None,
                    "time_end_ms": None,
                    "confidence": 1.0,
                }
            ]
            if content
            else []
        )

    def _extract_xlsx(self, source: Path) -> list[dict[str, Any]]:
        from openpyxl import load_workbook

        workbook = load_workbook(source, read_only=True, data_only=True)
        result: list[dict[str, Any]] = []
        for sheet in workbook.worksheets:
            rows = [
                ", ".join("" if cell is None else str(cell) for cell in row)
                for row in sheet.iter_rows(values_only=True)
            ]
            content = f"Sheet: {sheet.title}\n" + "\n".join(row for row in rows if row.strip(", "))
            if content.strip():
                result.append(
                    {
                        "kind": "spreadsheet",
                        "content": content,
                        "page_start": None,
                        "page_end": None,
                        "time_start_ms": None,
                        "time_end_ms": None,
                        "confidence": 1.0,
                    }
                )
        return result

    def _extract_image(
        self, source: Path, start_ms: int | None, end_ms: int | None
    ) -> list[dict[str, Any]]:
        import pytesseract

        content = pytesseract.image_to_string(str(source)).strip()
        return (
            [
                {
                    "kind": "ocr",
                    "content": content,
                    "page_start": None,
                    "page_end": None,
                    "time_start_ms": start_ms,
                    "time_end_ms": end_ms,
                    "confidence": 0.8,
                }
            ]
            if content
            else []
        )

    def _extract_audio(self, source: Path, start_ms: int, end_ms: int) -> list[dict[str, Any]]:
        transcript = self._transcribe(source)
        return (
            [
                {
                    "kind": "transcript",
                    "content": transcript,
                    "page_start": None,
                    "page_end": None,
                    "time_start_ms": start_ms,
                    "time_end_ms": end_ms,
                    "confidence": 0.82,
                }
            ]
            if transcript
            else []
        )

    def _extract_video(self, source: Path, directory: Path) -> list[dict[str, Any]]:
        duration = self._duration_ms(source)
        audio = directory / "audio.mp3"
        frames = directory / "frames"
        frames.mkdir()
        self._run_command(
            ["ffmpeg", "-y", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000", str(audio)]
        )
        self._run_command(
            ["ffmpeg", "-y", "-i", str(source), "-vf", "fps=1/30", str(frames / "frame-%03d.png")]
        )
        result = self._extract_audio(audio, 0, duration)
        for index, frame in enumerate(sorted(frames.glob("*.png"))):
            result.extend(
                self._extract_image(frame, index * 30_000, min((index + 1) * 30_000, duration))
            )
        return result

    def _duration_ms(self, source: Path) -> int:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(source),
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
        return max(1, int(float(completed.stdout.strip()) * 1000))

    def _run_command(self, command: list[str]) -> None:
        try:
            subprocess.run(command, check=True, capture_output=True, timeout=120)
        except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            raise IngestionError("Media processing failed safely.") from error

    def _transcribe(self, source: Path) -> str:
        if not self.openai_key or not self.transcription_model:
            raise IngestionError("Transcription is not configured for evidence ingestion.")
        boundary = f"----Tacit{uuid.uuid4().hex}"
        payload: list[bytes] = []

        def field(name: str, value: str) -> None:
            payload.extend(
                [
                    f"--{boundary}\r\n".encode(),
                    f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                    value.encode(),
                    b"\r\n",
                ]
            )

        field("model", self.transcription_model)
        field("response_format", "json")
        payload.extend(
            [
                f"--{boundary}\r\n".encode(),
                'Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode(),
                source.read_bytes(),
                b"\r\n",
                f"--{boundary}--\r\n".encode(),
            ]
        )
        request = Request(
            "https://api.openai.com/v1/audio/transcriptions", data=b"".join(payload), method="POST"
        )
        request.add_header("Authorization", f"Bearer {self.openai_key}")
        request.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        try:
            with urlopen(request, timeout=120) as response:
                return str(json.loads(response.read().decode("utf-8")).get("text", "")).strip()
        except HTTPError as error:
            raise IngestionError(f"Transcription request failed ({error.code}).") from error

    def _update_artifact(self, artifact_id: str, value: dict[str, Any]) -> None:
        value["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self._request(
            f"/rest/v1/evidence_artifacts?id=eq.{artifact_id}", method="PATCH", body=value
        )

    def _save_extractions(self, job: ClaimedJob, values: list[dict[str, Any]]) -> None:
        if values:
            source_version = job.storage_version or job.checksum_sha256
            self._request(
                "/rest/v1/evidence_extractions",
                method="POST",
                headers={"Prefer": "return=minimal"},
                body=[
                    {
                        **value,
                        "artifact_id": job.artifact_id,
                        "source_artifact_version": source_version,
                    }
                    for value in values
                ],
            )

    def _complete_job(
        self,
        job_id: str,
        status: str,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        self._request(
            f"/rest/v1/evidence_ingestion_jobs?id=eq.{job_id}",
            method="PATCH",
            body={
                "status": status,
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "error_code": error_code,
                "error_message": error_message,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )

    def _retry_or_fail(self, job: ClaimedJob, error: Exception) -> None:
        reason = str(error)[:500] or "Evidence ingestion failed."
        if job.attempts >= 5:
            self._update_artifact(
                job.artifact_id,
                {"status": "failed", "scan_status": "failed", "failure_reason": reason},
            )
            self._complete_job(job.job_id, "failed", "ingestion_failed", reason)
            return
        delay_seconds = min(3600, 30 * (2 ** (job.attempts - 1)))
        available_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + delay_seconds))
        self._update_artifact(
            job.artifact_id, {"status": "queued", "scan_status": "pending", "failure_reason": None}
        )
        self._request(
            f"/rest/v1/evidence_ingestion_jobs?id=eq.{job.job_id}",
            method="PATCH",
            body={
                "status": "queued",
                "available_at": available_at,
                "started_at": None,
                "error_code": None,
                "error_message": None,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
