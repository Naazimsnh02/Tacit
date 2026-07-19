from __future__ import annotations

import asyncio
import base64
import logging
import os
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .codex_runner import (
    SUPPORTED_IMAGE_MEDIA_TYPES,
    CodexAppServer,
    CodexAuthenticationRequired,
    CodexInputImage,
    CodexRunnerError,
    request_is_authorized,
)


logger = logging.getLogger(__name__)


class GenerateImage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    extraction_id: str | None = Field(default=None, alias="extractionId", max_length=200)
    media_type: Literal["image/jpeg", "image/png", "image/webp"] = Field(alias="mediaType")
    base64: str = Field(min_length=4, max_length=16_000_000)


class GenerateRequest(BaseModel):
    purpose: str = Field(
        pattern="^(workflow_reconstruction|agent_compilation|source_intelligence|cross_source_understanding|package_synthesis)$"
    )
    prompt: str = Field(min_length=1, max_length=512_000)
    images: list[GenerateImage] = Field(default_factory=list, max_length=64)
    detail: Literal["low", "high", "original"] | None = None


class DeviceLoginState:
    server: CodexAppServer | None = None
    task: asyncio.Task[None] | None = None
    error: str | None = None


login_state = DeviceLoginState()


def _secret() -> str:
    value = os.environ.get("CODEX_SUBSCRIPTION_RUNNER_SECRET")
    if not value:
        raise HTTPException(status_code=503, detail="Codex subscription runner is not configured.")
    return value


def _authorize(value: str | None) -> None:
    if not request_is_authorized(value, _secret()):
        raise HTTPException(status_code=401, detail="Unauthorized Codex runner request.")


def _model() -> str:
    value = os.environ.get("CODEX_SUBSCRIPTION_MODEL")
    if not value:
        raise HTTPException(status_code=503, detail="Codex subscription model is not configured.")
    return value


def _positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError as error:
        raise HTTPException(status_code=503, detail=f"{name} is invalid.") from error
    if value <= 0:
        raise HTTPException(status_code=503, detail=f"{name} is invalid.")
    return value


def decoded_images(images: list[GenerateImage], purpose: str) -> list[CodexInputImage]:
    if images and purpose != "source_intelligence":
        raise HTTPException(status_code=422, detail="Codex runner images are allowed only for source intelligence.")
    max_images = _positive_int_env("CODEX_SUBSCRIPTION_MAX_IMAGES", 8)
    max_encoded_bytes = _positive_int_env("CODEX_SUBSCRIPTION_MAX_IMAGE_PAYLOAD_BYTES", 12_000_000)
    if len(images) > max_images:
        raise HTTPException(status_code=422, detail="Too many images for one Codex runner request.")
    encoded_bytes = sum(len(image.base64) for image in images)
    if encoded_bytes > max_encoded_bytes:
        raise HTTPException(status_code=422, detail="Codex runner image payload is too large.")
    result: list[CodexInputImage] = []
    for image in images:
        if image.media_type not in SUPPORTED_IMAGE_MEDIA_TYPES:
            raise HTTPException(status_code=422, detail="Unsupported Codex runner image media type.")
        try:
            value = base64.b64decode(image.base64, validate=True)
        except (ValueError, TypeError) as error:
            raise HTTPException(status_code=422, detail="Codex runner image payload is not valid base64.") from error
        if not value:
            raise HTTPException(status_code=422, detail="Codex runner image payload is empty.")
        result.append(CodexInputImage(media_type=image.media_type, data=value, extraction_id=image.extraction_id))
    return result


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    if login_state.server:
        await login_state.server.close()


app = FastAPI(title="Tacit Codex Subscription Runner", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"service": "codex-subscription-runner", "status": "ok"}


@app.get("/codex/status")
async def status(x_tacit_codex_runner_secret: str | None = Header(default=None)) -> dict[str, object]:
    _authorize(x_tacit_codex_runner_secret)
    server = CodexAppServer(timeout_seconds=20)
    try:
        await server.start()
        account = await server.account_status()
        value = account.get("account")
        if not isinstance(value, dict) or value.get("type") != "chatgpt":
            return {"status": "login_required"}
        return {"status": "connected", "plan_type": value.get("planType")}
    except CodexRunnerError as error:
        return {"status": "unavailable", "error": str(error)}
    finally:
        await server.close()


@app.post("/codex/auth/device")
async def start_device_login(x_tacit_codex_runner_secret: str | None = Header(default=None)) -> dict[str, str]:
    _authorize(x_tacit_codex_runner_secret)
    if login_state.task and not login_state.task.done():
        raise HTTPException(status_code=409, detail="A Codex device-code login is already in progress.")
    server = CodexAppServer(timeout_seconds=900)
    try:
        await server.start()
        challenge = await server.start_device_login()
    except CodexRunnerError as error:
        await server.close()
        raise HTTPException(status_code=503, detail=str(error)) from error

    login_state.server = server
    login_state.error = None

    async def wait_for_completion() -> None:
        try:
            await server.wait_for_login(challenge["login_id"])
        except CodexRunnerError as error:
            login_state.error = str(error)
        finally:
            await server.close()
            login_state.server = None

    login_state.task = asyncio.create_task(wait_for_completion())
    return {"verification_url": challenge["verification_url"], "user_code": challenge["user_code"]}


@app.post("/codex/generate")
async def generate(request: GenerateRequest, x_tacit_codex_runner_secret: str | None = Header(default=None)) -> dict[str, object]:
    _authorize(x_tacit_codex_runner_secret)
    images = decoded_images(request.images, request.purpose)
    server = CodexAppServer(timeout_seconds=int(os.environ.get("CODEX_SUBSCRIPTION_TIMEOUT_SECONDS", "120")))
    try:
        await server.start()
        result = await server.generate(request.prompt, _model(), images=images, detail=request.detail)
        return {"output": result.output, "model": result.model, "response_id": result.response_id, "usage": result.usage}
    except CodexAuthenticationRequired as error:
        logger.warning("Codex subscription authentication failed: %s", error)
        raise HTTPException(status_code=503, detail=str(error)) from error
    except CodexRunnerError as error:
        # This is a private service log. The source worker intentionally returns a
        # generic message to users, while operators retain the actionable cause.
        logger.warning("Codex subscription generation failed: %s", error)
        raise HTTPException(status_code=502, detail=str(error)) from error
    finally:
        await server.close()
