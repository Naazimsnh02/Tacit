-- Phase 4: provenance and human promotion for real Codex-generated builds.
alter table agent_builds
  add column promotion_status text not null default 'pending' check (promotion_status in ('pending', 'promoted', 'rejected')),
  add column promoted_by uuid references auth.users(id) on delete set null,
  add column promoted_at timestamptz;

create table agent_build_repairs (
  id uuid primary key default gen_random_uuid(),
  agent_build_id uuid not null references agent_builds(id) on delete cascade,
  kind text not null check (kind in ('repair_proposal', 'clarification')),
  summary text not null check (char_length(summary) > 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index agent_build_repairs_build_created_idx on agent_build_repairs(agent_build_id, created_at desc);

alter table agent_build_repairs enable row level security;
create policy agent_build_repairs_read on agent_build_repairs for select using (private.can_read_build(agent_build_id));
create policy agent_build_repairs_write on agent_build_repairs for all using (private.can_write_build(agent_build_id)) with check (private.can_write_build(agent_build_id));

-- Build artifacts are inserted once by the server-side compiler. Their UUID
-- prefix is immutable for authenticated clients; source evidence retains its
-- existing retention/deletion behavior.
drop policy artifacts_update_writer on storage.objects;
drop policy artifacts_delete_writer on storage.objects;
create policy artifacts_update_writer on storage.objects for update using (
  bucket_id = 'tacit-artifacts' and private.can_write_artifact(name) and coalesce((storage.foldername(name))[3], '') <> 'builds'
) with check (
  bucket_id = 'tacit-artifacts' and private.can_write_artifact(name) and coalesce((storage.foldername(name))[3], '') <> 'builds'
);
create policy artifacts_delete_writer on storage.objects for delete using (
  bucket_id = 'tacit-artifacts' and private.can_write_artifact(name) and coalesce((storage.foldername(name))[3], '') <> 'builds'
);
