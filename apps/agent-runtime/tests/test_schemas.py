from app.schemas import AutomationBoundary, Project, ProjectStatus


def test_core_model_accepts_a_domain_neutral_project() -> None:
    project = Project.model_validate(
        {
            "id": "11111111-1111-4111-8111-111111111111",
            "name": "Example workflow",
            "workflow_type": "customer_support_escalation",
            "status": "active",
            "created_at": "2026-07-15T09:00:00Z",
            "updated_at": "2026-07-15T09:00:00Z",
        }
    )

    assert project.status is ProjectStatus.ACTIVE
    assert AutomationBoundary.HUMAN_APPROVAL.value == "human_approval"
