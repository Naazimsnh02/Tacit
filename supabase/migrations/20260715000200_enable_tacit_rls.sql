-- The MVP writes through server-side service-role credentials only. Enabling RLS
-- keeps all public REST access closed until user-scoped application policies exist.
alter table projects enable row level security;
alter table observation_sessions enable row level security;
alter table documents enable row level security;
alter table workflow_events enable row level security;
alter table workflow_versions enable row level security;
alter table decision_rules enable row level security;
alter table clarification_questions enable row level security;
alter table agent_builds enable row level security;
alter table test_cases enable row level security;
alter table test_runs enable row level security;
alter table test_case_results enable row level security;
alter table approval_requests enable row level security;
alter table approval_actions enable row level security;
alter table impact_snapshots enable row level security;
alter table invoice_exception_records enable row level security;
