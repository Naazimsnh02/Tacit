from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .codex_runner import CodexAppServer, CodexAuthenticationRequired, CodexRunnerError, request_is_authorized


class GenerateRequest(BaseModel):
    purpose: str = Field(pattern="^(workflow_reconstruction|agent_compilation)$")
    prompt: str = Field(min_length=1, max_length=512_000)


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
    server = CodexAppServer(timeout_seconds=int(os.environ.get("CODEX_SUBSCRIPTION_TIMEOUT_SECONDS", "120")))
    try:
        await server.start()
        result = await server.generate(request.prompt, _model())
        return {"output": result.output, "model": result.model, "response_id": result.response_id, "usage": result.usage}
    except CodexAuthenticationRequired as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except CodexRunnerError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    finally:
        await server.close()
