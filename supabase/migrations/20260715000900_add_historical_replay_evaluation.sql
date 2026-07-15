-- Historical replay is generic verification metadata. Workflow packs own the
-- input/outcome interpretation, while the core stores only the audit trace.
alter table test_runs
  add column run_type text not null default 'generated_tests'
    check (run_type in ('generated_tests', 'historical_replay'));

alter table test_case_results
  add column match_category text check (match_category in (
    'exact_match', 'acceptable_alternative', 'correct_escalation', 'incorrect', 'needs_clarification', 'execution_failure'
  )),
  add column applied_rule_ids jsonb not null default '[]'::jsonb,
  add column evidence_ids jsonb not null default '[]'::jsonb,
  add column confidence numeric check (confidence between 0 and 1),
  add column failure_explanation text,
  add column suggested_next_step text;

create index test_runs_project_historical_replay_idx on test_runs(project_id, started_at desc)
  where run_type = 'historical_replay';
create index test_case_results_match_category_idx on test_case_results(match_category);

-- The API writes with the server-side service role. Keep public access closed.
alter table test_runs enable row level security;
alter table test_case_results enable row level security;
