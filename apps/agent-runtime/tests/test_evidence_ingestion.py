import json
from pathlib import Path
from urllib.request import Request

from app.evidence_ingestion import ClaimedJob, EvidenceIngestionWorker


def job(attempts: int = 1) -> ClaimedJob:
    return ClaimedJob(
        job_id="11111111-1111-4111-8111-111111111111",
        attempts=attempts,
        artifact_id="22222222-2222-4222-8222-222222222222",
        project_id="33333333-3333-4333-8333-333333333333",
        organization_id="44444444-4444-4444-8444-444444444444",
        evidence_type="sop",
        filename="review.txt",
        media_type="text/plain",
        storage_key="org/project/artifact/source/review.txt",
        storage_version="version-1",
        checksum_sha256="a" * 64,
    )


def worker() -> EvidenceIngestionWorker:
    return EvidenceIngestionWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
        }
    )


def test_worker_scans_before_saving_normalized_evidence(monkeypatch) -> None:
    evidence_worker = worker()
    calls: list[str] = []
    monkeypatch.setattr(evidence_worker, "_purge_expired", lambda: calls.append("purge"))
    monkeypatch.setattr(evidence_worker, "_claim", lambda: job())
    monkeypatch.setattr(evidence_worker, "_download", lambda *_: calls.append("download"))
    monkeypatch.setattr(evidence_worker, "_scan", lambda *_: calls.append("scan"))
    monkeypatch.setattr(
        evidence_worker,
        "_update_artifact",
        lambda _id, value: calls.append(f"artifact:{value['status']}"),
    )
    monkeypatch.setattr(
        evidence_worker,
        "_extract",
        lambda *_: (
            calls.append("extract")
            or [
                {
                    "kind": "text",
                    "content": "Policy",
                    "page_start": 1,
                    "page_end": 1,
                    "time_start_ms": None,
                    "time_end_ms": None,
                    "confidence": 1.0,
                }
            ]
        ),
    )
    monkeypatch.setattr(evidence_worker, "_save_extractions", lambda *_: calls.append("save"))
    monkeypatch.setattr(evidence_worker, "_complete_job", lambda *_: calls.append("complete"))

    assert evidence_worker.run_once() is True
    assert calls == [
        "purge",
        "download",
        "scan",
        "artifact:processing",
        "extract",
        "save",
        "artifact:ready",
        "complete",
    ]


def test_worker_requeues_a_retryable_failure(monkeypatch) -> None:
    evidence_worker = worker()
    calls: list[str] = []
    monkeypatch.setattr(evidence_worker, "_purge_expired", lambda: None)
    monkeypatch.setattr(evidence_worker, "_claim", lambda: job())
    monkeypatch.setattr(
        evidence_worker,
        "_download",
        lambda *_: (_ for _ in ()).throw(RuntimeError("storage timeout")),
    )
    monkeypatch.setattr(
        evidence_worker,
        "_retry_or_fail",
        lambda claimed, error: calls.append(f"retry:{claimed.job_id}:{error}"),
    )

    assert evidence_worker.run_once() is True
    assert calls == ["retry:11111111-1111-4111-8111-111111111111:storage timeout"]


def test_empty_queue_does_not_create_temp_files(monkeypatch, tmp_path: Path) -> None:
    evidence_worker = worker()
    monkeypatch.setattr(evidence_worker, "_purge_expired", lambda: None)
    monkeypatch.setattr(evidence_worker, "_claim", lambda: None)
    assert evidence_worker.run_once() is False
    assert list(tmp_path.iterdir()) == []


def test_modal_transcription_uses_private_proxy_headers(monkeypatch, tmp_path: Path) -> None:
    evidence_worker = EvidenceIngestionWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "EVIDENCE_TRANSCRIPTION_PROVIDER": "modal",
            "EVIDENCE_MODAL_TRANSCRIPTION_URL": "https://example.modal.run/",
            "EVIDENCE_MODAL_PROXY_AUTH_KEY": "proxy-key",
            "EVIDENCE_MODAL_PROXY_AUTH_SECRET": "proxy-secret",
        }
    )
    source = tmp_path / "review.mp3"
    source.write_bytes(b"audio")
    requests: list[Request] = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self) -> bytes:
            return json.dumps({"text": "Reviewed invoice exception"}).encode()

    def fake_urlopen(request: Request, timeout: int):
        requests.append(request)
        assert timeout == 150
        return Response()

    monkeypatch.setattr("app.evidence_ingestion.urlopen", fake_urlopen)

    assert evidence_worker._transcribe(source, "modal") == "Reviewed invoice exception"
    assert requests[0].full_url == "https://example.modal.run/transcribe"
    assert requests[0].get_header("Modal-key") == "proxy-key"
    assert requests[0].get_header("Modal-secret") == "proxy-secret"


def test_video_can_select_a_different_transcription_provider() -> None:
    evidence_worker = EvidenceIngestionWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "EVIDENCE_TRANSCRIPTION_PROVIDER": "openai",
            "EVIDENCE_VIDEO_TRANSCRIPTION_PROVIDER": "modal",
        }
    )

    assert evidence_worker.audio_transcription_provider == "openai"
    assert evidence_worker.video_transcription_provider == "modal"


def test_image_ocr_uses_tesseract_word_confidence(monkeypatch, tmp_path: Path) -> None:
    evidence_worker = worker()
    source = tmp_path / "form.png"
    source.write_bytes(b"fake-image")

    class FakeOutput:
        DICT = "dict"

    def fake_image_to_data(_path: str, output_type=None):
        assert output_type == FakeOutput.DICT
        return {
            "text": ["", "DISPOSITION", "Reject", ""],
            "conf": ["-1", "91", "73", "-1"],
            "block_num": [0, 1, 1, 1],
            "par_num": [0, 1, 1, 1],
            "line_num": [0, 1, 2, 2],
        }

    monkeypatch.setitem(__import__("sys").modules, "pytesseract", type("P", (), {"image_to_data": staticmethod(fake_image_to_data), "Output": FakeOutput})())

    extractions = evidence_worker._extract_image(source, None, None)

    assert len(extractions) == 1
    assert extractions[0]["kind"] == "ocr"
    assert extractions[0]["content"] == "DISPOSITION\nReject"
    assert extractions[0]["confidence"] == 0.82  # mean of 0.91 and 0.73
    assert not any(item["kind"] == "visual" for item in extractions)


def test_image_ocr_returns_empty_when_tesseract_finds_no_words(monkeypatch, tmp_path: Path) -> None:
    evidence_worker = worker()
    source = tmp_path / "blank.png"
    source.write_bytes(b"fake-image")

    class FakeOutput:
        DICT = "dict"

    def fake_image_to_data(_path: str, output_type=None):
        return {"text": ["", ""], "conf": ["-1", "-1"], "block_num": [0, 0], "par_num": [0, 0], "line_num": [0, 0]}

    monkeypatch.setitem(__import__("sys").modules, "pytesseract", type("P", (), {"image_to_data": staticmethod(fake_image_to_data), "Output": FakeOutput})())

    assert evidence_worker._extract_image(source, None, None) == []
