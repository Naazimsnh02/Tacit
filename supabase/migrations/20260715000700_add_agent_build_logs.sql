create table agent_build_logs (
  id uuid primary key default gen_random_uuid(),
  agent_build_id uuid not null references agent_builds(id) on delete cascade,
  stage text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index agent_build_logs_agent_build_id_idx on agent_build_logs(agent_build_id, created_at);

-- Builds are persisted by the server-side service role; public REST remains closed.
alter table agent_build_logs enable row level security;
