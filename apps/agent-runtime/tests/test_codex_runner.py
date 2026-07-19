import asyncio
import base64
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.codex_runner import (
    JSONL_STREAM_LIMIT_BYTES,
    CodexAppServer,
    CodexInputImage,
    CodexRunnerError,
    final_agent_message,
    request_is_authorized,
)
from app.codex_runner_api import GenerateImage, _authorize, decoded_images


def test_runner_secret_comparison_requires_both_values() -> None:
    assert request_is_authorized("secret", "secret") is True
    assert request_is_authorized("wrong", "secret") is False
    assert request_is_authorized(None, "secret") is False


def test_final_agent_message_only_accepts_completed_final_text() -> None:
    assert final_agent_message({"method": "item/completed", "params": {"item": {"type": "agentMessage", "phase": "final_answer", "text": "{\"ok\":true}"}}}) == '{"ok":true}'
    assert final_agent_message({"method": "item/completed", "params": {"item": {"type": "agentMessage", "phase": "commentary", "text": "working"}}}) is None
    assert final_agent_message({"method": "turn/completed", "params": {}}) is None


def test_text_only_generation_input_is_unchanged(tmp_path: Path) -> None:
    assert CodexAppServer._turn_input_items("Return JSON.", [], tmp_path, None) == [
        {"type": "text", "text": "Return JSON."}
    ]


def test_text_only_generate_still_completes_without_capability_lookup() -> None:
    server = CodexAppServer()
    methods: list[str] = []
    messages = iter(
        [
            {"method": "item/completed", "params": {"item": {"type": "agentMessage", "phase": "final_answer", "text": "{\"ok\":true}"}}},
            {"method": "turn/completed", "params": {"turn": {"id": "turn-1", "status": "completed"}}},
        ]
    )

    async def request(method: str, _params: object) -> dict[str, object]:
        methods.append(method)
        if method == "account/read":
            return {"account": {"type": "chatgpt"}}
        if method == "thread/start":
            return {"thread": {"id": "thread-1"}}
        return {"turn": {"id": "turn-1"}}

    async def read() -> dict[str, object]:
        return next(messages)

    server.request = request  # type: ignore[method-assign]
    server._read = read  # type: ignore[method-assign]
    result = asyncio.run(server.generate("Return JSON.", "gpt-5.6-terra"))

    assert result.output == '{"ok":true}'
    assert methods == ["account/read", "thread/start", "turn/start"]


def test_multimodal_generation_uses_private_local_image_items(tmp_path: Path) -> None:
    items = CodexAppServer._turn_input_items(
        "Inspect this source.",
        [CodexInputImage(media_type="image/png", data=b"scan-cleared", extraction_id="extract-1")],
        tmp_path,
        "high",
    )

    assert items[0] == {"type": "text", "text": "Inspect this source."}
    assert items[1]["text"] == "Requested visual inspection detail: high."
    assert items[2]["text"] == "The next image is citeable extraction extract-1."
    assert items[3]["type"] == "localImage"
    assert Path(items[3]["path"]).read_bytes() == b"scan-cleared"


def test_model_capability_requires_image_input() -> None:
    server = CodexAppServer()

    async def request(_method: str, _params: object) -> dict[str, object]:
        return {"models": [{"id": "gpt-5.6-terra", "inputModalities": ["text", "image"]}]}

    server.request = request  # type: ignore[method-assign]
    asyncio.run(server._require_image_support("gpt-5.6-terra"))


def test_model_capability_accepts_the_current_paginated_app_server_shape() -> None:
    server = CodexAppServer()

    async def request(_method: str, _params: object) -> dict[str, object]:
        return {"data": [{"id": "gpt-5.6-terra", "inputModalities": ["text", "image"]}], "nextCursor": None}

    server.request = request  # type: ignore[method-assign]
    asyncio.run(server._require_image_support("gpt-5.6-terra"))


def test_runner_image_payload_limits_and_secret_are_enforced(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CODEX_SUBSCRIPTION_MAX_IMAGES", "1")
    monkeypatch.setenv("CODEX_SUBSCRIPTION_MAX_IMAGE_PAYLOAD_BYTES", "4")
    image = GenerateImage(mediaType="image/png", base64=base64.b64encode(b"pixel").decode())

    with pytest.raises(HTTPException, match="only for source intelligence"):
        decoded_images([image], "agent_compilation")
    with pytest.raises(HTTPException, match="too large"):
        decoded_images([image], "source_intelligence")
    with pytest.raises(ValidationError):
        GenerateImage(mediaType="image/gif", base64=base64.b64encode(b"pixel").decode())

    monkeypatch.setenv("CODEX_SUBSCRIPTION_RUNNER_SECRET", "a" * 32)
    with pytest.raises(HTTPException) as error:
        _authorize("wrong")
    assert error.value.status_code == 401


def test_jsonl_stream_limit_exceeds_asyncio_default() -> None:
    # Default asyncio StreamReader limit is 64 KiB; workflow JSONL is larger.
    assert JSONL_STREAM_LIMIT_BYTES > 64 * 1024


def test_read_accepts_large_jsonl_messages() -> None:
    payload = {
        "method": "item/completed",
        "params": {
            "item": {
                "type": "agentMessage",
                "phase": "final_answer",
                "text": "x" * 100_000,
            }
        },
    }
    line = (json.dumps(payload, separators=(",", ":")) + "\n").encode()
    assert len(line) > 64 * 1024

    async def run() -> dict[str, object]:
        reader = asyncio.StreamReader(limit=JSONL_STREAM_LIMIT_BYTES)
        reader.feed_data(line)
        reader.feed_eof()
        server = CodexAppServer()
        server.process = SimpleNamespace(stdout=reader)  # type: ignore[assignment]
        return dict(await server._read())

    message = asyncio.run(run())
    assert message["method"] == "item/completed"
    assert final_agent_message(message) == "x" * 100_000


def test_read_maps_stream_limit_overrun_to_runner_error() -> None:
    oversized = b'{"method":"item/completed","params":{"item":{"text":"' + (b"y" * 70_000)

    async def run() -> None:
        # Default 64 KiB limit reproduces the production failure mode.
        reader = asyncio.StreamReader(limit=64 * 1024)
        reader.feed_data(oversized)
        server = CodexAppServer()
        server.process = SimpleNamespace(stdout=reader)  # type: ignore[assignment]
        await server._read()

    with pytest.raises(CodexRunnerError, match="larger than the runner stream limit"):
        asyncio.run(run())
