alter table observation_sessions
  drop constraint observation_sessions_status_check;

alter table observation_sessions
  add constraint observation_sessions_status_check
  check (status in ('recording', 'paused', 'completed', 'abandoned'));
