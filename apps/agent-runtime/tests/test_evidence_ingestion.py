from pathlib import Path

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
