from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from .runtime import RuntimeError, RuntimeService, default_runtime_service

app = FastAPI(title="Tacit Agent Runtime")


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "agent-runtime", "status": "ok"}


class ExecuteRequest(BaseModel):
    payload: dict[str, object] = Field(default_factory=dict)


def runtime_service() -> RuntimeService:
    return default_runtime_service()


def _runtime_error(error: RuntimeError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


@app.post("/runtime/builds/{build_id}/validate")
def validate_build(build_id: UUID, runtime: RuntimeService = Depends(runtime_service)) -> dict[str, object]:
    try:
        return vars(runtime.validate(build_id))
    except RuntimeError as error:
        raise _runtime_error(error) from error


@app.post("/runtime/builds/{build_id}/test")
def test_build(build_id: UUID, runtime: RuntimeService = Depends(runtime_service)) -> dict[str, object]:
    try:
        return vars(runtime.test(build_id))
    except RuntimeError as error:
        raise _runtime_error(error) from error


@app.post("/runtime/builds/{build_id}/execute")
def execute_build(build_id: UUID, request: ExecuteRequest, runtime: RuntimeService = Depends(runtime_service)) -> dict[str, object]:
    try:
        return vars(runtime.execute(build_id, request.payload))
    except RuntimeError as error:
        raise _runtime_error(error) from error
