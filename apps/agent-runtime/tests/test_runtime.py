from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient

from app.main import app, runtime_service
from app.runtime import RuntimeService


BUILD_ID = UUID("55555555-5555-4555-8555-555555555555")


def write_build(root: Path, agent: str, test: str) -> Path:
    directory = root / "11111111-1111-4111-8111-111111111111" / str(BUILD_ID)
    directory.mkdir(parents=True)
    (directory / "agent.py").write_text(agent, encoding="utf-8")
    (directory / "test_agent.py").write_text(test, encoding="utf-8")
    return directory


def safe_agent() -> str:
    return "def evaluate(payload):\n    return {'status': 'human_review_required'}\n"


def test_allowed_generated_code_is_validated_tested_and_executed(tmp_path: Path) -> None:
    write_build(
        tmp_path, safe_agent(),
        "from agent import evaluate\n\ndef test_agent():\n    assert evaluate({})['status'] == 'human_review_required'\n",
    )
    runtime = RuntimeService(tmp_path, timeout_seconds=10)

    validation = runtime.validate(BUILD_ID)
    testing = runtime.test(BUILD_ID)
    execution = runtime.execute(BUILD_ID, {})

    assert validation.valid
    assert testing.status == "passed"
    assert testing.passed_tests == 1
    assert execution.status == "passed"
    assert 'human_review_required' in execution.stdout


def test_prohibited_imports_calls_and_filesystem_access_are_rejected(tmp_path: Path) -> None:
    write_build(
        tmp_path,
        "import os\n\ndef evaluate(payload):\n    return open('secret.txt').read()\n",
        "from agent import evaluate\n",
    )
    report = RuntimeService(tmp_path).validate(BUILD_ID)

    assert not report.valid
    assert any("import 'os' is not allowed" in error for error in report.errors)
    assert any("call to 'open' is not allowed" in error for error in report.errors)


def test_timeout_and_failure_output_are_captured(tmp_path: Path) -> None:
    write_build(
        tmp_path,
        "def evaluate(payload):\n    return {}\n",
        "def test_hangs():\n    while True:\n        pass\n",
    )
    report = RuntimeService(tmp_path, timeout_seconds=1).test(BUILD_ID)

    assert report.status == "timed_out"
    assert report.exit_code is None


def test_runtime_endpoints_return_safe_validation_errors(tmp_path: Path) -> None:
    write_build(tmp_path, "import subprocess\n", "from agent import evaluate\n")
    app.dependency_overrides[runtime_service] = lambda: RuntimeService(tmp_path)
    try:
        response = TestClient(app).post(f"/runtime/builds/{BUILD_ID}/validate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["valid"] is False
