create extension if not exists pgcrypto;

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  workflow_type text not null,
  status text not null check (status in ('draft', 'active', 'archived')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table observation_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null check (status in ('recording', 'completed', 'abandoned')),
  started_at timestamptz not null,
  completed_at timestamptz,
  narration text,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  observation_session_id uuid references observation_sessions(id) on delete set null,
  evidence_type text not null,
  title text not null,
  media_type text not null,
  storage_key text not null,
  schema_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table workflow_events (
  id uuid primary key default gen_random_uuid(),
  observation_session_id uuid not null references observation_sessions(id) on delete cascade,
  source text not null check (source in ('user', 'system', 'import')),
  action text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  evidence_ids jsonb not null default '[]'::jsonb
);

create table workflow_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'active', 'superseded')),
  specification jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create table decision_rules (
  id uuid primary key default gen_random_uuid(),
  workflow_version_id uuid not null references workflow_versions(id) on delete cascade,
  title text not null,
  condition text not null,
  outcome text not null,
  boundary text not null check (boundary in ('deterministic', 'ai_judgment', 'human_approval', 'unsupported')),
  status text not null check (status in ('inferred', 'confirmed', 'rejected')),
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table clarification_questions (
  id uuid primary key default gen_random_uuid(),
  workflow_version_id uuid not null references workflow_versions(id) on delete cascade,
  question text not null,
  rationale text not null,
  status text not null check (status in ('open', 'answered', 'dismissed')),
  answer text,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table agent_builds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workflow_version_id uuid not null references workflow_versions(id) on delete restrict,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  artifact_path text,
  manifest jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  input jsonb not null,
  expected_outcome jsonb not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workflow_version_id uuid not null references workflow_versions(id) on delete restrict,
  agent_build_id uuid references agent_builds(id) on delete set null,
  status text not null check (status in ('queued', 'running', 'passed', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz
);

create table test_case_results (
  id uuid primary key default gen_random_uuid(),
  test_run_id uuid not null references test_runs(id) on delete cascade,
  test_case_id uuid not null references test_cases(id) on delete cascade,
  status text not null check (status in ('passed', 'failed', 'skipped')),
  actual_outcome jsonb,
  message text,
  created_at timestamptz not null default now(),
  unique (test_run_id, test_case_id)
);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workflow_version_id uuid references workflow_versions(id) on delete set null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  evidence_ids jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table approval_actions (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references approval_requests(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  comment text,
  acted_at timestamptz not null
);

create table impact_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workflow_version_id uuid references workflow_versions(id) on delete set null,
  observed_cases integer not null check (observed_cases >= 0),
  automation_coverage_percent numeric not null check (automation_coverage_percent between 0 and 100),
  accuracy_percent numeric not null check (accuracy_percent between 0 and 100),
  estimated_minutes_saved numeric not null check (estimated_minutes_saved >= 0),
  assumptions jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null
);

create index observation_sessions_project_id_idx on observation_sessions(project_id);
create index documents_project_id_idx on documents(project_id);
create index workflow_versions_project_id_idx on workflow_versions(project_id);
create index test_cases_project_id_idx on test_cases(project_id);
create index approval_requests_project_id_idx on approval_requests(project_id);

-- Invoice Exception is a workflow-pack table. Its domain data stays out of core tables.
create table invoice_exception_records (
  project_id uuid not null references projects(id) on delete cascade,
  record_id text not null,
  record_type text not null,
  schema_version text not null,
  payload jsonb not null,
  primary key (project_id, record_id)
);
