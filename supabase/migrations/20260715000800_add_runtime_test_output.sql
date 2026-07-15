-- Runtime output is generic build/test telemetry. Domain outcomes remain in
-- test_case_results, where workflow packs supply their validated payloads.
alter table test_runs
  add column exit_code integer,
  add column duration_ms integer check (duration_ms >= 0),
  add column passed_tests integer not null default 0 check (passed_tests >= 0),
  add column failed_tests integer not null default 0 check (failed_tests >= 0),
  add column stdout text,
  add column stderr text;

-- Writes are server-side only; no public policy is introduced for runtime logs.
alter table test_runs enable row level security;
