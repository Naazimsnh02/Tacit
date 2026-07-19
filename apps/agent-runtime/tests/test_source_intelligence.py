import json

import pytest

from app.source_intelligence import SourceArtifact, SourceIntelligenceError, SourceIntelligenceWorker
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
        "classification": {"content": "screen", "confidence": 0.9, "extractionIds": citation},
        "summary": {"content": "A durometer reading screen.", "confidence": 0.9, "extractionIds": citation},
        "entities": [{"content": "Shore A", "type": "measurement", "value": "Shore A", "confidence": 0.9, "extractionIds": citation}],
        "facts": [{"content": "A value is displayed.", "confidence": 0.8, "extractionIds": citation}],
        "tableStructures": [],
        "systemContexts": [],
        "quality": {"confidence": 0.9, "needsHigherDetail": False},
    }


def test_interpretation_persists_only_cited_rows(monkeypatch) -> None:
    source_worker = worker()
    requests: list[tuple[str, object]] = []
    monkeypatch.setattr(source_worker, "_request", lambda path, **kwargs: requests.append((path, kwargs.get("body"))))

    source_worker._save_interpretation("project", "artifact", interpretation(), [extraction()])

    assert requests[0][0] == "/rest/v1/evidence_insights"
    rows = requests[0][1]
    assert isinstance(rows, list)
    assert {row["kind"] for row in rows} == {"source_classification", "summary", "entity", "fact"}
    assert all(row["extraction_ids"] == [extraction()["id"]] for row in rows)


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
