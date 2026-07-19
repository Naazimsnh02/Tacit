from __future__ import annotations

import asyncio
import hmac
import json
import os
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class CodexRunnerError(Exception):
    """A safe error from the isolated Codex subscription runner."""


class CodexAuthenticationRequired(CodexRunnerError):
    pass


SUPPORTED_IMAGE_MEDIA_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


@dataclass(frozen=True)
class CodexGeneration:
    output: str
    model: str
    response_id: str | None
    usage: object | None


@dataclass(frozen=True)
class CodexInputImage:
    """Trusted, already scan-cleared image bytes supplied to the private runner."""

    media_type: str
    data: bytes
    extraction_id: str | None = None


def request_is_authorized(provided: str | None, expected: str | None) -> bool:
    return bool(provided and expected and hmac.compare_digest(provided, expected))


def final_agent_message(message: Mapping[str, Any]) -> str | None:
    if message.get("method") != "item/completed":
        return None
    params = message.get("params")
    if not isinstance(params, Mapping):
        return None
    item = params.get("item")
    if not isinstance(item, Mapping) or item.get("type", item.get("itemType")) != "agentMessage":
        return None
    if item.get("phase") not in (None, "final_answer"):
        return None
    text = item.get("text")
    return text if isinstance(text, str) and text.strip() else None


class CodexAppServer:
    """A small JSONL client for a local, never-network-exposed Codex app-server."""

    def __init__(self, command: str = "codex", timeout_seconds: int = 120) -> None:
        self.command = command
        self.timeout_seconds = timeout_seconds
        self.process: asyncio.subprocess.Process | None = None
        self._next_id = 1
        self._latest_agent_message: str | None = None

    async def start(self) -> None:
        try:
            self.process = await asyncio.create_subprocess_exec(
                self.command,
                "app-server",
                "--listen",
                "stdio://",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={
                    "PATH": os.environ.get("PATH", ""),
                    "HOME": os.environ.get("HOME", "/tmp"),
                    "CODEX_HOME": os.environ.get("CODEX_HOME", "/codex-home"),
                },
            )
        except FileNotFoundError as error:
            raise CodexRunnerError("The Codex subscription runner is not installed.") from error
        await self.request(
            "initialize",
            {"clientInfo": {"name": "tacit_hackathon_runner", "title": "Tacit", "version": "0.1.0"}},
        )
        await self.notify("initialized", {})

    async def close(self) -> None:
        if not self.process:
            return
        if self.process.returncode is None:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=2)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()

    async def notify(self, method: str, params: Mapping[str, Any]) -> None:
        await self._write({"method": method, "params": params})

    async def request(self, method: str, params: Mapping[str, Any]) -> Mapping[str, Any]:
        request_id = self._next_id
        self._next_id += 1
        await self._write({"method": method, "id": request_id, "params": params})
        while True:
            message = await self._read()
            if message.get("id") != request_id:
                self._observe(message)
                continue
            error = message.get("error")
            if isinstance(error, Mapping):
                detail = error.get("message")
                raise CodexRunnerError(str(detail) if detail else "Codex app-server rejected the request.")
            result = message.get("result")
            if not isinstance(result, Mapping):
                raise CodexRunnerError("Codex app-server returned an invalid response.")
            return result

    async def wait_for_login(self, login_id: str) -> None:
        while True:
            message = await self._read()
            params = message.get("params")
            if message.get("method") != "account/login/completed" or not isinstance(params, Mapping):
                self._observe(message)
                continue
            if params.get("loginId") != login_id:
                continue
            if params.get("success") is True:
                return
            raise CodexRunnerError("Codex subscription login was not completed.")

    async def generate(
        self,
        prompt: str,
        model: str,
        *,
        images: list[CodexInputImage] | None = None,
        detail: str | None = None,
    ) -> CodexGeneration:
        self._latest_agent_message = None
        account = await self.request("account/read", {"refreshToken": True})
        if not isinstance(account.get("account"), Mapping) or account["account"].get("type") != "chatgpt":
            raise CodexAuthenticationRequired("The Codex subscription runner needs a ChatGPT device-code login.")
        images = images or []
        if images:
            await self._require_image_support(model)
        thread_result = await self.request("thread/start", {"model": model, "sandbox": "read-only"})
        thread = thread_result.get("thread")
        if not isinstance(thread, Mapping) or not isinstance(thread.get("id"), str):
            raise CodexRunnerError("Codex app-server did not create a compilation thread.")
        # The documented app-server input union supports `localImage`, while remote
        # image URLs are rejected at ingress. Decode trusted bytes only inside this
        # runner and pass their temporary local paths to keep subscription tokens and
        # Storage credentials entirely inside their respective private services.
        with tempfile.TemporaryDirectory(prefix="tacit-codex-images-") as temp:
            turn_result = await self.request(
                "turn/start",
                {
                    "threadId": thread["id"],
                    "input": self._turn_input_items(prompt, images, Path(temp), detail),
                    "sandbox": "read-only",
                },
            )
            turn = turn_result.get("turn")
            response_id = turn.get("id") if isinstance(turn, Mapping) and isinstance(turn.get("id"), str) else None
            while True:
                message = await self._read()
                self._observe(message)
                if message.get("method") != "turn/completed":
                    continue
                params = message.get("params")
                completed = params.get("turn") if isinstance(params, Mapping) else None
                if not isinstance(completed, Mapping):
                    continue
                if response_id and completed.get("id") != response_id:
                    continue
                if completed.get("status") not in ("completed", "success"):
                    raise CodexRunnerError("Codex did not complete the compilation turn.")
                if not self._latest_agent_message:
                    raise CodexRunnerError("Codex returned no final compilation output.")
                return CodexGeneration(self._latest_agent_message, model, response_id, None)

    async def _require_image_support(self, model: str) -> None:
        result = await self.request("model/list", {})
        values = result.get("models")
        if not isinstance(values, list):
            raise CodexRunnerError("Codex subscription multimodal capability could not be verified.")
        for value in values:
            if not isinstance(value, Mapping):
                continue
            identifiers = {str(value.get(key)) for key in ("id", "model", "slug") if value.get(key)}
            if model not in identifiers:
                continue
            modalities = value.get("inputModalities", value.get("input_modalities"))
            if isinstance(modalities, list) and "image" in {str(item).lower() for item in modalities}:
                return
            break
        raise CodexRunnerError(
            "Codex subscription multimodal is unavailable for the configured model; choose a subscription model with image input."
        )

    @staticmethod
    def _turn_input_items(
        prompt: str, images: list[CodexInputImage], directory: Path, detail: str | None
    ) -> list[dict[str, str]]:
        items: list[dict[str, str]] = [{"type": "text", "text": prompt}]
        if images and detail:
            # App-server localImage has no documented detail field. This preserves
            # source-intelligence escalation intent as a model-visible instruction.
            items.append({"type": "text", "text": f"Requested visual inspection detail: {detail}."})
        for index, image in enumerate(images, start=1):
            if image.media_type not in SUPPORTED_IMAGE_MEDIA_TYPES or not image.data:
                raise CodexRunnerError("Codex runner received an unsupported image payload.")
            suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[image.media_type]
            path = directory / f"scan-cleared-{index}{suffix}"
            path.write_bytes(image.data)
            path.chmod(0o600)
            if image.extraction_id:
                items.append({"type": "text", "text": f"The next image is citeable extraction {image.extraction_id}."})
            items.append({"type": "localImage", "path": str(path)})
        return items

    async def start_device_login(self) -> dict[str, str]:
        result = await self.request("account/login/start", {"type": "chatgptDeviceCode"})
        login_id = result.get("loginId")
        verification_url = result.get("verificationUrl")
        user_code = result.get("userCode")
        if not all(isinstance(value, str) and value for value in (login_id, verification_url, user_code)):
            raise CodexRunnerError("Codex did not return a device-code login challenge.")
        return {"login_id": login_id, "verification_url": verification_url, "user_code": user_code}

    async def account_status(self) -> Mapping[str, Any]:
        return await self.request("account/read", {"refreshToken": True})

    async def _write(self, message: Mapping[str, Any]) -> None:
        if not self.process or not self.process.stdin:
            raise CodexRunnerError("Codex app-server is unavailable.")
        self.process.stdin.write((json.dumps(message, separators=(",", ":")) + "\n").encode())
        await self.process.stdin.drain()

    async def _read(self) -> Mapping[str, Any]:
        if not self.process or not self.process.stdout:
            raise CodexRunnerError("Codex app-server is unavailable.")
        try:
            line = await asyncio.wait_for(self.process.stdout.readline(), timeout=self.timeout_seconds)
        except asyncio.TimeoutError as error:
            raise CodexRunnerError("Codex subscription request timed out.") from error
        if not line:
            raise CodexRunnerError("Codex app-server stopped unexpectedly.")
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError as error:
            raise CodexRunnerError("Codex app-server emitted an invalid message.") from error
        if not isinstance(parsed, Mapping):
            raise CodexRunnerError("Codex app-server emitted an invalid message.")
        return parsed

    def _observe(self, message: Mapping[str, Any]) -> None:
        output = final_agent_message(message)
        if output:
            self._latest_agent_message = output
