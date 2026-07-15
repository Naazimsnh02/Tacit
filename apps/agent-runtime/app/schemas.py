from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ObservationSessionStatus(StrEnum):
    RECORDING = "recording"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class WorkflowEventSource(StrEnum):
    USER = "user"
    SYSTEM = "system"
    IMPORT = "import"


class AutomationBoundary(StrEnum):
    DETERMINISTIC = "deterministic"
    AI_JUDGMENT = "ai_judgment"
    HUMAN_APPROVAL = "human_approval"
    UNSUPPORTED = "unsupported"


class DecisionRuleStatus(StrEnum):
    INFERRED = "inferred"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class ContradictionSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ClarificationQuestionStatus(StrEnum):
    OPEN = "open"
    ANSWERED = "answered"
    DISMISSED = "dismissed"


class AgentBuildStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class TestRunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"


class TestResultStatus(StrEnum):
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ApprovalRequestStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class Project(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=160)
    workflow_type: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    status: ProjectStatus
    configuration: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ObservationSession(BaseModel):
    id: UUID
    project_id: UUID
    status: ObservationSessionStatus
    started_at: datetime
    completed_at: datetime | None = None
    narration: str | None = None
    created_at: datetime


class WorkflowEvent(BaseModel):
    id: UUID
    observation_session_id: UUID
    source: WorkflowEventSource
    action: str = Field(min_length=1)
    occurred_at: datetime
    payload: dict[str, Any]
    evidence_ids: list[UUID] = Field(default_factory=list)


class DocumentEvidence(BaseModel):
    id: UUID
    project_id: UUID
    observation_session_id: UUID | None = None
    evidence_type: str = Field(min_length=1)
    title: str = Field(min_length=1)
    media_type: str = Field(min_length=1)
    storage_key: str = Field(min_length=1)
    schema_version: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class WorkflowStep(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    boundary: AutomationBoundary
    evidence_ids: list[UUID] = Field(min_length=1)


class DecisionRule(BaseModel):
    id: UUID
    workflow_version_id: UUID
    title: str = Field(min_length=1)
    condition: str = Field(min_length=1)
    outcome: str = Field(min_length=1)
    boundary: AutomationBoundary
    status: DecisionRuleStatus
    evidence_ids: list[UUID] = Field(min_length=1)
    created_at: datetime


class Contradiction(BaseModel):
    id: str = Field(min_length=1)
    description: str = Field(min_length=1)
    severity: ContradictionSeverity
    evidence_ids: list[UUID] = Field(min_length=2)


class ClarificationQuestion(BaseModel):
    id: UUID
    workflow_version_id: UUID
    question: str = Field(min_length=1)
    rationale: str = Field(min_length=1)
    status: ClarificationQuestionStatus
    answer: str | None = None
    evidence_ids: list[UUID] = Field(min_length=1)
    created_at: datetime
    answered_at: datetime | None = None


class WorkflowSpecification(BaseModel):
    workflow_version_id: UUID
    steps: list[WorkflowStep]
    rules: list[DecisionRule]
    approval_boundaries: list[str]


class AgentBuild(BaseModel):
    id: UUID
    project_id: UUID
    workflow_version_id: UUID
    status: AgentBuildStatus
    artifact_path: str | None = None
    manifest: dict[str, Any] | None = None
    failure_reason: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class TestCase(BaseModel):
    id: UUID
    project_id: UUID
    label: str = Field(min_length=1)
    input: dict[str, Any]
    expected_outcome: dict[str, Any]
    evidence_ids: list[UUID] = Field(default_factory=list)
    created_at: datetime


class TestResult(BaseModel):
    id: UUID
    test_run_id: UUID
    test_case_id: UUID
    status: TestResultStatus
    actual_outcome: dict[str, Any] | None = None
    message: str | None = None
    created_at: datetime


class ApprovalRequest(BaseModel):
    id: UUID
    project_id: UUID
    workflow_version_id: UUID | None = None
    status: ApprovalRequestStatus
    reason: str = Field(min_length=1)
    risk_level: ContradictionSeverity
    evidence_ids: list[UUID] = Field(min_length=1)
    payload: dict[str, Any]
    created_at: datetime


class ImpactMetrics(BaseModel):
    id: UUID
    project_id: UUID
    workflow_version_id: UUID | None = None
    observed_cases: int = Field(ge=0)
    automation_coverage_percent: float = Field(ge=0, le=100)
    accuracy_percent: float = Field(ge=0, le=100)
    estimated_minutes_saved: float = Field(ge=0)
    assumptions: list[str]
    captured_at: datetime
