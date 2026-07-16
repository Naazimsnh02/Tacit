-- Phase 3: a production workflow cannot enter compilation until an SME attests
-- to its rules, contradictions, automation boundaries, and approval policy.
create table workflow_confirmations (
  workflow_version_id uuid primary key references workflow_versions(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  rules_confirmed boolean not null check (rules_confirmed),
  contradictions_reviewed boolean not null check (contradictions_reviewed),
  automation_boundaries_confirmed boolean not null check (automation_boundaries_confirmed),
  approval_policies_confirmed boolean not null check (approval_policies_confirmed),
  created_at timestamptz not null default now()
);

create index workflow_confirmations_project_id_idx on workflow_confirmations(project_id);
alter table workflow_confirmations enable row level security;
create policy workflow_confirmations_read on workflow_confirmations for select using (private.can_read_workflow_version(workflow_version_id));
create policy workflow_confirmations_insert on workflow_confirmations for insert with check (
  confirmed_by = auth.uid() and private.can_write_workflow_version(workflow_version_id)
  and private.can_write_project(project_id)
);
