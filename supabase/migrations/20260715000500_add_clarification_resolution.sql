alter table clarification_questions
  add column related_rule_id text,
  add column answer_type text not null default 'free_text' check (answer_type in ('single_select', 'multi_select', 'number', 'boolean', 'free_text')),
  add column suggested_answers jsonb not null default '[]'::jsonb,
  add column risk_if_unanswered text not null default 'Clarification is required before safe automation.',
  add column answer_value jsonb;

create table workflow_rule_diffs (
  id uuid primary key default gen_random_uuid(),
  previous_workflow_version_id uuid not null references workflow_versions(id) on delete cascade,
  workflow_version_id uuid not null references workflow_versions(id) on delete cascade,
  rule_id text not null,
  before_rule jsonb not null,
  after_rule jsonb not null,
  created_at timestamptz not null default now()
);

alter table agent_builds drop constraint agent_builds_status_check;
alter table agent_builds add constraint agent_builds_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'stale'));
