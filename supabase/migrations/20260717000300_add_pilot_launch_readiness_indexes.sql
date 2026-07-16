-- Phase 6: keep the supervised pilot's project-scoped reads and audit trail responsive.
-- All affected tables already have tenant RLS policies; these indexes only support
-- the joins and ordered reads exercised by the authenticated application APIs.
create index if not exists agent_builds_project_created_idx on agent_builds(project_id, created_at desc);
create index if not exists agent_builds_workflow_version_idx on agent_builds(workflow_version_id);
create index if not exists approval_actions_request_idx on approval_actions(approval_request_id, acted_at desc);
create index if not exists approval_actions_actor_idx on approval_actions(actor_id) where actor_id is not null;
create index if not exists approval_requests_build_idx on approval_requests(agent_build_id) where agent_build_id is not null;
create index if not exists test_runs_project_created_idx on test_runs(project_id, started_at desc);
create index if not exists test_case_results_run_idx on test_case_results(test_run_id, created_at asc);
create index if not exists workflow_versions_project_created_idx on workflow_versions(project_id, created_at desc);
create index if not exists clarification_questions_version_idx on clarification_questions(workflow_version_id);
