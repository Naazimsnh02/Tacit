from __future__ import annotations

import ast
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID


MAX_SOURCE_BYTES = 128 * 1024
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
    def __init__(self, generated_root: Path, timeout_seconds: int = 10) -> None:
        self.generated_root = generated_root.resolve()
        self.timeout_seconds = timeout_seconds

    def _build_directory(self, build_id: UUID) -> Path:
        matches = list(self.generated_root.glob(f"*/{build_id}"))
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
        report = self._run(directory, [sys.executable, "-B", "-m", "pytest", "-q"])
        passed, failed = _parse_pytest_counts(report.stdout + "\n" + report.stderr)
        return ProcessReport(report.status, report.exit_code, report.duration_ms, report.stdout, report.stderr, passed, failed)

    def execute(self, build_id: UUID, payload: dict[str, object]) -> ProcessReport:
        directory = self._build_directory(build_id)
        self._require_valid(build_id)
        program = (
            "import json, runpy, sys\n"
            "namespace = runpy.run_path('agent.py')\n"
            "result = namespace['evaluate'](json.loads(sys.stdin.read()))\n"
            "print(json.dumps(result))\n"
        )
        return self._run(directory, [sys.executable, "-B", "-c", program], json.dumps(payload))

    def _require_valid(self, build_id: UUID) -> None:
        report = self.validate(build_id)
        if not report.valid:
            raise ValidationError("Generated code failed static validation: " + "; ".join(report.errors))

    def _run(self, directory: Path, command: list[str], stdin: str | None = None) -> ProcessReport:
        started = time.monotonic()
        try:
            completed = subprocess.run(
                command, cwd=directory, input=stdin, text=True, capture_output=True,
                timeout=self.timeout_seconds,
            )
            return ProcessReport(
                "passed" if completed.returncode == 0 else "failed", completed.returncode,
                int((time.monotonic() - started) * 1000), _truncate(completed.stdout), _truncate(completed.stderr),
            )
        except subprocess.TimeoutExpired as error:
            return ProcessReport("timed_out", None, int((time.monotonic() - started) * 1000), _truncate(error.stdout or ""), _truncate(error.stderr or ""))


def default_runtime_service() -> RuntimeService:
    import os

    root = Path(os.environ.get("TACIT_GENERATED_ROOT", Path.cwd() / "generated"))
    timeout = int(os.environ.get("AGENT_EXECUTION_TIMEOUT_SECONDS", "10"))
    return RuntimeService(root, timeout)


def _truncate(value: str | bytes) -> str:
    text = value.decode() if isinstance(value, bytes) else value
    return text[:MAX_OUTPUT_BYTES]


def _parse_pytest_counts(output: str) -> tuple[int, int]:
    counts = {match.group("status"): int(match.group("count")) for match in PYTEST_COUNT.finditer(output)}
    return counts.get("passed", 0), counts.get("failed", 0)
