import json

import pytest

from app.source_intelligence import ClaimedPlatformJob, SourceArtifact, SourceIntelligenceError, SourceIntelligenceWorker
from app.video_sampling import VideoFrame


def worker() -> SourceIntelligenceWorker:
    return SourceIntelligenceWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "OPENAI_API_KEY": "openai-key",
            "EVIDENCE_VISION_MODEL": "configured-vision-model",
        }
    )


def extraction() -> dict[str, object]:
    return {"id": "11111111-1111-4111-8111-111111111111", "kind": "visual", "content": "Image source", "confidence": 1}


def interpretation() -> dict[str, object]:
    citation = ["11111111-1111-4111-8111-111111111111"]
    return {
        "sourceClass": "screen",
        "sourceRole": "system_screenshot",
        "classification": {"content": "screen", "confidence": 0.9, "extractionIds": citation},
        "summary": {"content": "A durometer reading screen.", "confidence": 0.9, "extractionIds": citation},
        "processObjective": {
            "content": "Record hardness measurement for disposition.",
            "confidence": 0.8,
            "extractionIds": citation,
        },
        "entities": [{"content": "Shore A", "type": "measurement", "value": "Shore A", "confidence": 0.9, "extractionIds": citation}],
        "facts": [{"content": "A value is displayed.", "confidence": 0.8, "extractionIds": citation}],
        "tableStructures": [],
        "systemContexts": [],
        "actors": [{"content": "Quality inspector", "role": "inspector", "confidence": 0.8, "extractionIds": citation}],
        "processSteps": [
            {
                "name": "Read durometer",
                "description": "Capture Shore A hardness from the gauge.",
                "kind": "check",
                "orderHint": 1,
                "confidence": 0.85,
                "extractionIds": citation,
            }
        ],
        "decisions": [
            {
                "name": "Hardness gate",
                "condition": "Shore A outside specification",
                "action": "fail inspection",
                "risk": "high",
                "confidence": 0.8,
                "extractionIds": citation,
            }
        ],
        "thresholds": [
            {
                "name": "shore_a_max",
                "value": "75",
                "unit": "Shore A",
                "confidence": 0.7,
                "extractionIds": citation,
            }
        ],
        "caseFields": [{"name": "lot", "value": "LOT-1", "confidence": 0.7, "extractionIds": citation}],
        "exceptions": [],
        "neverAutomate": [
            {
                "content": "Do not scrap material without Quality Manager approval.",
                "confidence": 0.9,
                "extractionIds": citation,
            }
        ],
        "quality": {"confidence": 0.9, "needsHigherDetail": False},
    }


def package_synthesis() -> dict[str, object]:
    citation = ["11111111-1111-4111-8111-111111111111"]
    return {
        "processObjective": {
            "content": "Review a quality complaint and recommend disposition.",
            "confidence": 0.9,
            "extractionIds": citation,
        },
        "primaryCase": {
            "content": "QC-1 failed inspection for lot LOT-1.",
            "confidence": 0.9,
            "extractionIds": citation,
        },
        "policyRules": [
            {
                "name": "Value gate",
                "condition": "rejectedValue >= 5000",
                "action": "require manager approval",
                "risk": "high",
                "confidence": 0.9,
                "extractionIds": citation,
            }
        ],
        "caseFacts": [{"name": "complaintId", "value": "QC-1", "confidence": 0.9, "extractionIds": citation}],
        "suggestedSteps": [
            {
                "name": "Match identifiers",
                "description": "Confirm complaint, PO, and lot identifiers.",
                "kind": "check",
                "orderHint": 1,
                "confidence": 0.9,
                "extractionIds": citation,
            }
        ],
        "missingForAutomation": [],
        "neverAutomate": [
            {
                "content": "Never release quarantined material without approval.",
                "confidence": 0.95,
                "extractionIds": citation,
            }
        ],
        "contradictions": [],
    }


def test_interpretation_persists_only_cited_rows(monkeypatch) -> None:
    source_worker = worker()
    requests: list[tuple[str, object]] = []
    monkeypatch.setattr(source_worker, "_request", lambda path, **kwargs: requests.append((path, kwargs.get("body"))))

    source_worker._save_interpretation("project", "artifact", interpretation(), [extraction()])

    assert requests[0][0] == "/rest/v1/evidence_insights"
    rows = requests[0][1]
    assert isinstance(rows, list)
    assert {
        "source_classification",
        "source_role",
        "summary",
        "process_objective",
        "entity",
        "fact",
        "actor",
        "process_step",
        "process_decision",
        "threshold",
        "case_field",
        "never_automate",
    }.issubset({row["kind"] for row in rows})
    assert all(row["extraction_ids"] == [extraction()["id"]] for row in rows)
    decision = next(row for row in rows if row["kind"] == "process_decision")
    assert "→" in decision["content"]
    step = next(row for row in rows if row["kind"] == "process_step")
    assert step["entity_type"] == "check"


def test_interpretation_drops_hallucinated_citations(monkeypatch) -> None:
    source_worker = worker()
    invalid = interpretation()
    invalid["facts"] = [{"content": "Unsupported", "confidence": 0.9, "extractionIds": ["22222222-2222-4222-8222-222222222222"]}]
    requests: list[object] = []
    monkeypatch.setattr(source_worker, "_request", lambda _path, **kwargs: requests.append(kwargs.get("body")))

    source_worker._save_interpretation("project", "artifact", invalid, [extraction()])
    rows = requests[0]
    assert isinstance(rows, list)
    assert all(row["kind"] != "fact" for row in rows)


def test_source_interpretation_retries_only_unfinished_artifacts(monkeypatch) -> None:
    source_worker = worker()
    completed = SourceArtifact("completed", "project", "text/plain", "complete.txt", None, "checksum")
    pending = SourceArtifact("pending", "project", "text/plain", "pending.txt", None, "checksum")
    interpreted: list[str] = []

    monkeypatch.setattr(source_worker, "_project_artifacts", lambda _project_id: [completed, pending])
    monkeypatch.setattr(source_worker, "_interpreted_artifact_ids", lambda _project_id: {"completed"})
    monkeypatch.setattr(source_worker, "_artifact_extractions", lambda artifact_id: [{**extraction(), "id": artifact_id}])
    monkeypatch.setattr(source_worker, "_interpret_source", lambda *_args: interpretation())
    monkeypatch.setattr(source_worker, "_save_interpretation", lambda _project, artifact_id, *_args: interpreted.append(artifact_id))

    source_worker._interpret_project_sources(
        ClaimedPlatformJob("job", 2, "project", "source_interpretation", {"evidenceIds": ["pending"]})
    )

    assert interpreted == ["pending"]


def test_visual_artifact_without_ocr_is_still_interpreted() -> None:
    image = SourceArtifact("image", "project", "image/png", "image.png", None, "checksum")
    document = SourceArtifact("document", "project", "text/plain", "document.txt", None, "checksum")

    assert SourceIntelligenceWorker._should_interpret_artifact(image, [], {"other-extraction"}) is True
    assert SourceIntelligenceWorker._should_interpret_artifact(document, [], {"other-extraction"}) is False


def test_retry_records_the_attempt_outcome(monkeypatch) -> None:
    source_worker = worker()
    requests: list[tuple[str, object]] = []
    monkeypatch.setattr(source_worker, "_request", lambda path, **kwargs: requests.append((path, kwargs.get("body"))))

    source_worker._retry_or_fail(
        ClaimedPlatformJob("job", 2, "project", "source_interpretation", {}),
        SourceIntelligenceError("temporary model failure"),
    )

    assert requests[0][0] == "/rest/v1/platform_jobs?id=eq.job"
    assert isinstance(requests[0][1], dict)
    assert requests[0][1]["status"] == "queued"
    assert requests[1][0] == "/rest/v1/platform_job_attempts?job_id=eq.job&attempt=eq.2"
    assert requests[1][1]["status"] == "retrying"
    assert requests[1][1]["error_message"] == "temporary model failure"


def test_codex_subscription_uses_text_evidence_without_an_openai_key() -> None:
    source_worker = SourceIntelligenceWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "LLM_BACKEND": "codex_subscription",
            "CODEX_SUBSCRIPTION_RUNNER_URL": "http://localhost:8100",
            "CODEX_SUBSCRIPTION_RUNNER_SECRET": "a" * 32,
            "CODEX_SUBSCRIPTION_MODEL": "gpt-5.6-terra",
        }
    )

    source_worker._ensure_model()

    assert source_worker._model_version() == "gpt-5.6-terra"


def test_codex_subscription_collects_scan_cleared_image_pixels(tmp_path, monkeypatch) -> None:
    source_worker = SourceIntelligenceWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "LLM_BACKEND": "codex_subscription",
            "CODEX_SUBSCRIPTION_RUNNER_URL": "http://localhost:8100",
            "CODEX_SUBSCRIPTION_RUNNER_SECRET": "a" * 32,
            "CODEX_SUBSCRIPTION_MODEL": "gpt-5.6-terra",
        }
    )
    artifact = SourceArtifact("artifact", "project", "image/png", "clean/source.png", None, "checksum")
    monkeypatch.setattr(source_worker, "_download", lambda _key, destination: destination.write_bytes(b"pixels"))

    images, _ = source_worker._visual_inputs(artifact, [extraction()], tmp_path)

    assert images == [(extraction()["id"], tmp_path / "source", "image/png")]


def test_codex_subscription_collects_sampled_video_frame_pixels(tmp_path, monkeypatch) -> None:
    source_worker = SourceIntelligenceWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "LLM_BACKEND": "codex_subscription",
            "CODEX_SUBSCRIPTION_RUNNER_URL": "http://localhost:8100",
            "CODEX_SUBSCRIPTION_RUNNER_SECRET": "a" * 32,
            "CODEX_SUBSCRIPTION_MODEL": "gpt-5.6-terra",
        }
    )
    artifact = SourceArtifact("artifact", "project", "video/mp4", "clean/source.mp4", None, "checksum")
    frame = tmp_path / "frames" / "frame-0000002000.jpg"
    frame.parent.mkdir()
    frame.write_bytes(b"frame-pixels")
    monkeypatch.setattr(source_worker, "_download", lambda _key, destination: destination.write_bytes(b"video"))
    monkeypatch.setattr("app.source_intelligence.video_duration_ms", lambda _source: 10_000)
    monkeypatch.setattr("app.source_intelligence.sample_video_frames", lambda *_args, **_kwargs: [VideoFrame(2_000, frame)])
    monkeypatch.setattr(source_worker, "_save_visual_extraction", lambda *_args, **_kwargs: "frame-extract")
    frame_extraction = {**extraction(), "id": "frame-extract", "kind": "frame", "time_start_ms": 2_000}
    monkeypatch.setattr(source_worker, "_artifact_extractions", lambda _artifact_id: [extraction(), frame_extraction])

    images, _ = source_worker._visual_inputs(artifact, [extraction()], tmp_path)

    assert images == [("frame-extract", frame, "image/jpeg")]


def test_codex_source_request_contains_base64_image_payload(tmp_path, monkeypatch) -> None:
    source_worker = SourceIntelligenceWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "LLM_BACKEND": "codex_subscription",
            "CODEX_SUBSCRIPTION_RUNNER_URL": "http://localhost:8100",
            "CODEX_SUBSCRIPTION_RUNNER_SECRET": "a" * 32,
            "CODEX_SUBSCRIPTION_MODEL": "gpt-5.6-terra",
        }
    )
    image = tmp_path / "frame.png"
    image.write_bytes(b"pixels")
    captured: dict[str, object] = {}

    class Response:
        def read(self) -> bytes:
            return b'{"output":"{}"}'

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    def urlopen(request, **_kwargs):
        captured.update(json.loads(request.data.decode()))
        return Response()

    monkeypatch.setattr("app.source_intelligence.urlopen", urlopen)
    assert source_worker._codex_subscription_json("Inspect", {}, "source_intelligence", [("extract-1", image, "image/png")], "high") == {}
    assert captured["detail"] == "high"
    assert captured["images"] == [
        {"extractionId": "extract-1", "mediaType": "image/png", "base64": "cGl4ZWxz"}
    ]


def test_codex_text_only_source_request_omits_images(monkeypatch) -> None:
    source_worker = SourceIntelligenceWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "LLM_BACKEND": "codex_subscription",
            "CODEX_SUBSCRIPTION_RUNNER_URL": "http://localhost:8100",
            "CODEX_SUBSCRIPTION_RUNNER_SECRET": "a" * 32,
            "CODEX_SUBSCRIPTION_MODEL": "gpt-5.6-terra",
        }
    )
    captured: dict[str, object] = {}

    def codex_json(_prompt, _schema, _purpose, images, _detail):
        captured["images"] = images
        return {}

    monkeypatch.setattr(source_worker, "_codex_subscription_json", codex_json)
    assert source_worker._responses_json("Inspect", {}, [], "high", purpose="source_intelligence") == {}
    assert captured["images"] == []


def test_openai_source_request_still_uses_responses_input_image(tmp_path, monkeypatch) -> None:
    source_worker = worker()
    image = tmp_path / "frame.png"
    image.write_bytes(b"pixels")
    captured: dict[str, object] = {}

    class Response:
        def read(self) -> bytes:
            return b'{"output_text":"{}"}'

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    def urlopen(request, **_kwargs):
        captured.update(json.loads(request.data.decode()))
        return Response()

    monkeypatch.setattr("app.source_intelligence.urlopen", urlopen)
    assert source_worker._responses_json("Inspect", {}, [("extract-1", image, "image/png")], "high", purpose="source_intelligence") == {}
    content = captured["input"][0]["content"]
    assert content[-1] == {"type": "input_image", "image_url": "data:image/png;base64,cGl4ZWxz", "detail": "high"}


def test_codex_source_intelligence_requires_runner_configuration() -> None:
    source_worker = SourceIntelligenceWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "LLM_BACKEND": "codex_subscription",
        }
    )

    with pytest.raises(SourceIntelligenceError, match="not configured"):
        source_worker._ensure_model()


def test_package_synthesis_persists_project_level_process_draft(monkeypatch) -> None:
    source_worker = worker()
    requests: list[tuple[str, str | None, object]] = []

    def fake_request(path: str, **kwargs):
        method = kwargs.get("method")
        body = kwargs.get("body")
        requests.append((path, method, body))
        if path.startswith("/rest/v1/evidence_insights?project_id=") and method is None:
            return [
                {
                    "id": "insight-1",
                    "kind": "process_decision",
                    "content": "value gate",
                    "extraction_ids": [extraction()["id"]],
                    "confidence": 0.9,
                    "artifact_id": "artifact",
                    "created_at": "2026-07-18T00:00:00Z",
                }
            ]
        return None

    monkeypatch.setattr(source_worker, "_request", fake_request)
    monkeypatch.setattr(source_worker, "_responses_json", lambda *_args, **_kwargs: package_synthesis())

    source_worker._synthesize_package(
        ClaimedPlatformJob("job", 1, "project", "package_synthesis", {"evidenceIds": [extraction()["id"]]})
    )

    posted = next(body for path, method, body in requests if path == "/rest/v1/evidence_insights" and method == "POST")
    assert isinstance(posted, list)
    assert {row["kind"] for row in posted} >= {
        "package_objective",
        "package_primary_case",
        "package_policy_rule",
        "package_case_fact",
        "package_suggested_step",
        "package_never_automate",
    }
    assert all(row["artifact_id"] is None for row in posted)
    assert all(row["model_role"] == "package_synthesis" for row in posted)
    assert all(row["extraction_ids"] == [extraction()["id"]] for row in posted)
    assert any(method == "DELETE" for _path, method, _body in requests)


def test_package_synthesis_rejects_uncited_claims(monkeypatch) -> None:
    source_worker = worker()

    def fake_request(path: str, **kwargs):
        if path.startswith("/rest/v1/evidence_insights?project_id=") and kwargs.get("method") is None:
            return [
                {
                    "id": "insight-1",
                    "kind": "summary",
                    "content": "A policy",
                    "extraction_ids": [extraction()["id"]],
                    "confidence": 0.9,
                    "artifact_id": "artifact",
                    "created_at": "2026-07-18T00:00:00Z",
                }
            ]
        return None

    bad = ["22222222-2222-4222-8222-222222222222"]
    invalid = {
        "processObjective": {"content": "x", "confidence": 0.9, "extractionIds": bad},
        "primaryCase": {"content": "y", "confidence": 0.9, "extractionIds": bad},
        "policyRules": [],
        "caseFacts": [],
        "suggestedSteps": [],
        "missingForAutomation": [],
        "neverAutomate": [],
        "contradictions": [],
    }
    monkeypatch.setattr(source_worker, "_request", fake_request)
    monkeypatch.setattr(source_worker, "_responses_json", lambda *_args, **_kwargs: invalid)

    with pytest.raises(SourceIntelligenceError, match="cited process structure"):
        source_worker._synthesize_package(
            ClaimedPlatformJob("job", 1, "project", "package_synthesis", {})
        )


def test_legacy_interpretation_without_process_fields_still_persists(monkeypatch) -> None:
    source_worker = worker()
    requests: list[object] = []
    monkeypatch.setattr(source_worker, "_request", lambda _path, **kwargs: requests.append(kwargs.get("body")))
    legacy = {
        "sourceClass": "policy",
        "classification": {
            "content": "policy",
            "confidence": 0.9,
            "extractionIds": [extraction()["id"]],
        },
        "summary": {
            "content": "A policy document.",
            "confidence": 0.9,
            "extractionIds": [extraction()["id"]],
        },
        "entities": [],
        "facts": [{"content": "Review is required.", "confidence": 0.8, "extractionIds": [extraction()["id"]]}],
        "tableStructures": [],
        "systemContexts": [],
        "quality": {"confidence": 0.9, "needsHigherDetail": False},
    }

    source_worker._save_interpretation("project", "artifact", legacy, [extraction()])
    rows = requests[0]
    assert isinstance(rows, list)
    assert {row["kind"] for row in rows} >= {"source_classification", "summary", "fact", "source_role"}


def test_source_backend_can_use_openai_while_workflow_uses_subscription() -> None:
    source_worker = SourceIntelligenceWorker(
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service",
            "LLM_BACKEND": "codex_subscription",
            "EVIDENCE_SOURCE_INTELLIGENCE_BACKEND": "openai_api",
            "OPENAI_API_KEY": "openai-key",
            "EVIDENCE_VISION_MODEL": "gpt-5.6-luna",
        }
    )

    source_worker._ensure_model()

    assert source_worker._model_version() == "gpt-5.6-luna"
