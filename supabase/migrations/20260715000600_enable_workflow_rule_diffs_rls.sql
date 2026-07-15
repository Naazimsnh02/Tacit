-- This table was introduced after the initial RLS rollout. Keep the MVP's
-- server-only persistence model consistent by denying public REST access.
alter table workflow_rule_diffs enable row level security;
