-- AI-first phases 2–7. These are additive, project-owned records; they never
-- store workflow-pack payloads or make a proposed change executable by itself.

create table evidence_insights (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  artifact_id uuid references evidence_artifacts(id) on delete cascade, kind text not null check (kind in ('source_classification','summary','entity','fact','table_structure','system_context')),
  content text not null, entity_type text, entity_value text, confidence numeric not null check (confidence between 0 and 1),
  extraction_ids jsonb not null check (jsonb_typeof(extraction_ids) = 'array'), model_role text not null, model_version text not null, created_at timestamptz not null default now()
);
create table evidence_relationships (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  from_insight_id uuid not null references evidence_insights(id) on delete cascade, to_insight_id uuid not null references evidence_insights(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('supports','contradicts','references','same_entity','precedes')),
  rationale text not null, extraction_ids jsonb not null check (jsonb_typeof(extraction_ids) = 'array'), confidence numeric not null check (confidence between 0 and 1), created_at timestamptz not null default now(),
  check (from_insight_id <> to_insight_id)
);
create table workflow_claims (
  id uuid primary key default gen_random_uuid(), workflow_version_id uuid not null references workflow_versions(id) on delete cascade,
  claim_type text not null check (claim_type in ('step','rule','decision','assumption')), claim_key text not null, statement text not null,
  evidence_state text not null check (evidence_state in ('confirmed','strongly_inferred','weakly_inferred','contradictory','missing_evidence','requires_expert_confirmation')),
  confidence numeric check (confidence between 0 and 1), extraction_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(extraction_ids) = 'array'), created_at timestamptz not null default now(),
  unique (workflow_version_id, claim_type, claim_key)
);
create table workflow_change_proposals (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  workflow_version_id uuid not null references workflow_versions(id) on delete restrict, requested_change text not null, patch jsonb not null check (jsonb_typeof(patch) = 'array'),
  affected_rule_ids jsonb not null default '[]'::jsonb, impact jsonb not null default '{}'::jsonb, risk_level text not null check (risk_level in ('low','medium','high')),
  status text not null check (status in ('pending','accepted','rejected','superseded')) default 'pending', proposed_by uuid references auth.users(id) on delete set null,
  resulting_workflow_version_id uuid references workflow_versions(id) on delete set null, created_at timestamptz not null default now(), decided_at timestamptz
);
create table clarification_assignments (
  id uuid primary key default gen_random_uuid(), question_id uuid not null unique references clarification_questions(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null, defer_reason text, due_at timestamptz, attachment_extraction_ids jsonb not null default '[]'::jsonb,
  status text not null check (status in ('open','deferred','answered')) default 'open', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table agent_readiness_reviews (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  workflow_version_id uuid not null references workflow_versions(id) on delete restrict, recommended_mode text not null check (recommended_mode in ('observe_only','recommend','execute_with_approval','low_risk_automatic')),
  reasons jsonb not null default '[]'::jsonb, metrics jsonb not null default '{}'::jsonb, status text not null check (status in ('draft','approved','rejected')) default 'draft', reviewed_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), reviewed_at timestamptz
);
create table operating_observations (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  workflow_version_id uuid references workflow_versions(id) on delete set null, kind text not null check (kind in ('override','new_evidence','change_detection','outcome')),
  payload jsonb not null default '{}'::jsonb, evidence_ids jsonb not null default '[]'::jsonb, submitted_by uuid references auth.users(id) on delete set null,
  proposal_id uuid references workflow_change_proposals(id) on delete set null, created_at timestamptz not null default now()
);
-- Durable job ledger. A worker claims records using an atomic RPC/deployment
-- adapter; web requests only enqueue or inspect status.
create table platform_jobs (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('source_interpretation','cross_source_understanding','test_plan','readiness_review','operating_analysis')),
  payload jsonb not null default '{}'::jsonb, status text not null check (status in ('queued','running','succeeded','failed','cancelled')) default 'queued',
  idempotency_key text not null, attempts integer not null default 0 check (attempts between 0 and 5), available_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (project_id, kind, idempotency_key)
);

create index evidence_insights_project_idx on evidence_insights(project_id, created_at desc);
create index evidence_relationships_project_idx on evidence_relationships(project_id, created_at desc);
create index workflow_claims_version_idx on workflow_claims(workflow_version_id, created_at);
create index change_proposals_project_idx on workflow_change_proposals(project_id, created_at desc);
create index readiness_reviews_project_idx on agent_readiness_reviews(project_id, created_at desc);
create index operating_observations_project_idx on operating_observations(project_id, created_at desc);
create index platform_jobs_queue_idx on platform_jobs(status, available_at) where status = 'queued';

alter table evidence_insights enable row level security;
alter table evidence_relationships enable row level security;
alter table workflow_claims enable row level security;
alter table workflow_change_proposals enable row level security;
alter table clarification_assignments enable row level security;
alter table agent_readiness_reviews enable row level security;
alter table operating_observations enable row level security;
alter table platform_jobs enable row level security;

create policy evidence_insights_read on evidence_insights for select using (private.can_read_project(project_id));
create policy evidence_insights_write on evidence_insights for all using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
create policy evidence_relationships_read on evidence_relationships for select using (private.can_read_project(project_id));
create policy evidence_relationships_write on evidence_relationships for all using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
create policy workflow_claims_read on workflow_claims for select using (private.can_read_workflow_version(workflow_version_id));
create policy workflow_claims_write on workflow_claims for all using (private.can_write_workflow_version(workflow_version_id)) with check (private.can_write_workflow_version(workflow_version_id));
create policy workflow_change_proposals_read on workflow_change_proposals for select using (private.can_read_project(project_id));
create policy workflow_change_proposals_write on workflow_change_proposals for all using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
create policy clarification_assignments_read on clarification_assignments for select using (exists (select 1 from clarification_questions q where q.id = question_id and private.can_read_workflow_version(q.workflow_version_id)));
create policy clarification_assignments_write on clarification_assignments for all using (exists (select 1 from clarification_questions q where q.id = question_id and private.can_write_workflow_version(q.workflow_version_id))) with check (exists (select 1 from clarification_questions q where q.id = question_id and private.can_write_workflow_version(q.workflow_version_id)));
create policy readiness_reviews_read on agent_readiness_reviews for select using (private.can_read_project(project_id));
create policy readiness_reviews_write on agent_readiness_reviews for all using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
create policy operating_observations_read on operating_observations for select using (private.can_read_project(project_id));
create policy operating_observations_write on operating_observations for all using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
create policy platform_jobs_read on platform_jobs for select using (private.can_read_project(project_id));
create policy platform_jobs_write on platform_jobs for all using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
