from __future__ import annotations

import ast
import json
import re
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from collections.abc import Callable
from typing import Protocol
from uuid import UUID, uuid4


MAX_SOURCE_BYTES = 128 * 1024
MAX_INPUT_BYTES = 256 * 1024
MAX_OUTPUT_BYTES = 64 * 1024
ALLOWED_IMPORTS = {"typing", "pydantic", "agent"}
FORBIDDEN_CALLS = {
    "__import__", "compile", "eval", "exec", "getattr", "globals", "locals", "open",
    "vars", "input", "breakpoint", "help", "dir",
}
FORBIDDEN_MODULES = {
    "asyncio", "builtins", "ctypes", "http", "importlib", "io", "multiprocessing", "os",
    "pathlib", "pickle", "shutil", "socket", "subprocess", "sys", "urllib",
}
PYTEST_COUNT = re.compile(r"(?P<count>\d+) (?P<status>passed|failed)")


class RuntimeError(Exception):
    """A safe, user-facing generated-artifact error."""


class ValidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class ValidationReport:
    valid: bool
    errors: list[str]
    files_checked: int


@dataclass(frozen=True)
class ProcessReport:
    status: str
    exit_code: int | None
    duration_ms: int
    stdout: str
    stderr: str
    passed_tests: int = 0
    failed_tests: int = 0


class ContainerRunner(Protocol):
    def run(self, directory: Path, command: list[str], stdin: str | None, timeout_seconds: int) -> ProcessReport:
        """Run generated code in an isolated, ephemeral environment."""


@dataclass(frozen=True)
class ContainerLimits:
    memory: str = "256m"
    cpus: str = "0.5"
    pids: int = 64
    tmpfs_size: str = "16m"


def create_container_command(
    directory: Path,
    command: list[str],
    image: str,
    container_name: str,
    limits: ContainerLimits = ContainerLimits(),
) -> list[str]:
    """Build the Docker invocation without inheriting host state or credentials."""
    return [
        "docker", "run", "--rm", "--name", container_name,
        "--network", "none", "--read-only", "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges", "--pids-limit", str(limits.pids),
        "--memory", limits.memory, "--memory-swap", limits.memory,
        "--cpus", limits.cpus, "--ulimit", "nofile=64:64",
        "--tmpfs", f"/tmp:rw,nosuid,nodev,noexec,size={limits.tmpfs_size}",
        "--mount", f"type=bind,src={directory.resolve()},dst=/workspace,readonly",
        "--workdir", "/workspace", "--user", "65532:65532",
        "--env", "PYTHONDONTWRITEBYTECODE=1", image, *command,
    ]


class DockerContainerRunner:
    """Executes an artifact in a one-shot Docker container, never on the host."""

    def __init__(self, image: str, limits: ContainerLimits = ContainerLimits()) -> None:
        self.image = image
        self.limits = limits

    def run(self, directory: Path, command: list[str], stdin: str | None, timeout_seconds: int) -> ProcessReport:
        if not shutil.which("docker"):
            raise RuntimeError("The isolated container runtime is unavailable.")
        if not directory.is_dir():
            raise RuntimeError("Generated build artifact was not found.")

        container_name = f"tacit-agent-{uuid4().hex}"
        docker_command = create_container_command(directory, command, self.image, container_name, self.limits)
        started = time.monotonic()
        try:
            process = subprocess.Popen(
                docker_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
        except OSError as error:
            raise RuntimeError("The isolated container runtime could not start.") from error

        if stdin:
            assert process.stdin is not None
            try:
                process.stdin.write(stdin.encode("utf-8"))
            except BrokenPipeError:
                pass
        if process.stdin:
            process.stdin.close()

        stdout, stderr, output_exceeded = _capture_process_output(process)
        timed_out = False
        while process.poll() is None:
            if output_exceeded.is_set():
                self._stop(container_name)
                break
            if time.monotonic() - started >= timeout_seconds:
                timed_out = True
                self._stop(container_name)
                break
            time.sleep(0.01)
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()

        duration_ms = int((time.monotonic() - started) * 1000)
        if output_exceeded.is_set():
            return ProcessReport("output_limit_exceeded", process.returncode, duration_ms, stdout(), stderr())
        if timed_out:
            return ProcessReport("timed_out", None, duration_ms, stdout(), stderr())
        return ProcessReport(
            "passed" if process.returncode == 0 else "failed", process.returncode, duration_ms, stdout(), stderr(),
        )

    @staticmethod
    def _stop(container_name: str) -> None:
        # The generated program is already inside Docker; this only stops its
        # named ephemeral container when a runtime limit is exceeded.
        subprocess.run(["docker", "kill", container_name], capture_output=True, check=False, timeout=2)


def _capture_process_output(process: subprocess.Popen[bytes]) -> tuple[Callable[[], str], Callable[[], str], threading.Event]:
    captured = {"stdout": bytearray(), "stderr": bytearray()}
    output_exceeded = threading.Event()
    lock = threading.Lock()

    def read_stream(name: str, stream: object) -> None:
        assert hasattr(stream, "read")
        while chunk := stream.read(4096):
            with lock:
                remaining = MAX_OUTPUT_BYTES - len(captured["stdout"]) - len(captured["stderr"])
                if remaining <= 0:
                    output_exceeded.set()
                    continue
                captured[name].extend(chunk[:remaining])
                if len(chunk) > remaining:
                    output_exceeded.set()

    assert process.stdout is not None and process.stderr is not None
    readers = [
        threading.Thread(target=read_stream, args=("stdout", process.stdout), daemon=True),
        threading.Thread(target=read_stream, args=("stderr", process.stderr), daemon=True),
    ]
    for reader in readers:
        reader.start()

    def result(name: str) -> str:
        for reader in readers:
            reader.join()
        return captured[name].decode("utf-8", errors="replace")

    return lambda: result("stdout"), lambda: result("stderr"), output_exceeded


class GeneratedCodeValidator(ast.NodeVisitor):
    def __init__(self, filename: str) -> None:
        self.filename = filename
        self.errors: list[str] = []

    def _error(self, node: ast.AST, message: str) -> None:
        self.errors.append(f"{self.filename}:{getattr(node, 'lineno', 0)}: {message}")

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self._check_import(node, alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.level or not node.module:
            self._error(node, "relative imports are not allowed")
        else:
            self._check_import(node, node.module)
        self.generic_visit(node)

    def _check_import(self, node: ast.AST, module: str) -> None:
        root = module.split(".")[0]
        if root in FORBIDDEN_MODULES or root not in ALLOWED_IMPORTS:
            self._error(node, f"import '{module}' is not allowed")
        if root == "agent" and not self.filename.startswith("test_"):
            self._error(node, "only generated tests may import the agent module")

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name) and node.func.id in FORBIDDEN_CALLS:
            self._error(node, f"call to '{node.func.id}' is not allowed")
        if isinstance(node.func, ast.Attribute) and node.func.attr.startswith("__"):
            self._error(node, "dunder attribute calls are not allowed")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr.startswith("__"):
            self._error(node, "dunder attribute access is not allowed")
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id.startswith("__"):
            self._error(node, "dunder names are not allowed")
        self.generic_visit(node)


class RuntimeService:
    def __init__(self, generated_root: Path, timeout_seconds: int = 10, container_runner: ContainerRunner | None = None) -> None:
        self.generated_root = generated_root.resolve()
        self.timeout_seconds = timeout_seconds
        self.container_runner = container_runner or DockerContainerRunner("tacit-agent-sandbox:latest")

    def _build_directory(self, build_id: UUID) -> Path:
        matches = list(self.generated_root.rglob(str(build_id)))
        if len(matches) != 1 or not matches[0].is_dir():
            raise RuntimeError("Generated build artifact was not found.")
        directory = matches[0].resolve()
        if self.generated_root not in directory.parents:
            raise RuntimeError("Generated build artifact is outside the allowed directory.")
        return directory

    def validate(self, build_id: UUID) -> ValidationReport:
        directory = self._build_directory(build_id)
        files = sorted(directory.glob("*.py"))
        if not files:
            return ValidationReport(False, ["No Python files were generated for this build."], 0)
        errors: list[str] = []
        for file in files:
            if file.stat().st_size > MAX_SOURCE_BYTES:
                errors.append(f"{file.name}: generated source exceeds the {MAX_SOURCE_BYTES}-byte limit")
                continue
            try:
                tree = ast.parse(file.read_text(encoding="utf-8"), filename=file.name)
            except (UnicodeDecodeError, SyntaxError) as error:
                errors.append(f"{file.name}: invalid Python source ({error.msg if isinstance(error, SyntaxError) else 'invalid encoding'})")
                continue
            validator = GeneratedCodeValidator(file.name)
            validator.visit(tree)
            errors.extend(validator.errors)
        return ValidationReport(not errors, errors, len(files))

    def test(self, build_id: UUID) -> ProcessReport:
        directory = self._build_directory(build_id)
        self._require_valid(build_id)
        report = self._run(directory, ["python", "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider"])
        passed, failed = _parse_pytest_counts(report.stdout + "\n" + report.stderr)
        return ProcessReport(report.status, report.exit_code, report.duration_ms, report.stdout, report.stderr, passed, failed)

    def execute(self, build_id: UUID, payload: dict[str, object]) -> ProcessReport:
        directory = self._build_directory(build_id)
        self._require_valid(build_id)
        encoded_payload = json.dumps(payload)
        if len(encoded_payload.encode("utf-8")) > MAX_INPUT_BYTES:
            raise RuntimeError("Agent input exceeds the allowed size.")
        program = (
            "import json, runpy, sys\n"
            "namespace = runpy.run_path('agent.py')\n"
            "result = namespace['evaluate'](json.loads(sys.stdin.read()))\n"
            "print(json.dumps(result))\n"
        )
        return self._run(directory, ["python", "-B", "-c", program], encoded_payload)

    def _require_valid(self, build_id: UUID) -> None:
        report = self.validate(build_id)
        if not report.valid:
            raise ValidationError("Generated code failed static validation: " + "; ".join(report.errors))

    def _run(self, directory: Path, command: list[str], stdin: str | None = None) -> ProcessReport:
        return self.container_runner.run(directory, command, stdin, self.timeout_seconds)


def default_runtime_service() -> RuntimeService:
    import os

    root = Path(os.environ.get("TACIT_GENERATED_ROOT", Path.cwd() / "generated"))
    timeout = int(os.environ.get("AGENT_EXECUTION_TIMEOUT_SECONDS", "10"))
    image = os.environ.get("AGENT_SANDBOX_IMAGE", "tacit-agent-sandbox:latest")
    return RuntimeService(root, timeout, DockerContainerRunner(image))


def _parse_pytest_counts(output: str) -> tuple[int, int]:
    counts = {match.group("status"): int(match.group("count")) for match in PYTEST_COUNT.finditer(output)}
    return counts.get("passed", 0), counts.get("failed", 0)
