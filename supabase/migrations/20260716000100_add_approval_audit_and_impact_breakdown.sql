-- Milestone 10: domain-agnostic approval audit details and stored impact breakdowns.
-- RLS remains enabled from 20260715000200; application access is server-side only.
alter table approval_requests
  add column requested_action text not null default 'human_review',
  add column agent_recommendation text not null default 'human_review',
  add column confidence numeric check (confidence between 0 and 1),
  add column applied_rule_ids jsonb not null default '[]'::jsonb,
  add column agent_build_id uuid references agent_builds(id) on delete set null;

alter table approval_actions
  drop constraint approval_actions_decision_check,
  add constraint approval_actions_decision_check check (decision in ('approved', 'rejected', 'request_more_information', 'escalated')),
  add column approver text not null default 'Demo approver';

alter table impact_snapshots
  add column manual_steps integer not null default 0 check (manual_steps >= 0),
  add column automated_steps integer not null default 0 check (automated_steps >= 0),
  add column ai_assisted_steps integer not null default 0 check (ai_assisted_steps >= 0),
  add column human_required_steps integer not null default 0 check (human_required_steps >= 0),
  add column manual_handling_minutes numeric not null default 0 check (manual_handling_minutes >= 0),
  add column estimated_automated_minutes numeric not null default 0 check (estimated_automated_minutes >= 0),
  add column review_rate_percent numeric not null default 0 check (review_rate_percent between 0 and 100),
  add column rules_discovered integer not null default 0 check (rules_discovered >= 0),
  add column undocumented_exceptions integer not null default 0 check (undocumented_exceptions >= 0),
  add column sources jsonb not null default '{}'::jsonb;

create index approval_requests_project_status_idx on approval_requests(project_id, status, created_at desc);
create index impact_snapshots_project_captured_idx on impact_snapshots(project_id, captured_at desc);
