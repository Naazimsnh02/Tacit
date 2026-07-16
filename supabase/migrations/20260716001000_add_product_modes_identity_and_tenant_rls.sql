-- Phase 0 and 1: explicit product modes, tenant ownership, and authenticated access.
-- Demo data remains in a dedicated organization and is only mutated by the
-- explicitly named demo seed/reset scripts using the service role.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  mode text not null check (mode in ('production', 'demo')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table organization_memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

insert into organizations (id, name, slug, mode)
values ('00000000-0000-4000-8000-000000000001', 'Tacit Demo', 'tacit-demo', 'demo')
on conflict (id) do nothing;

alter table projects add column organization_id uuid references organizations(id) on delete restrict;
alter table projects add column mode text check (mode in ('production', 'demo'));
alter table projects add column created_by uuid references auth.users(id) on delete set null;

update projects
set organization_id = '00000000-0000-4000-8000-000000000001', mode = 'demo'
where organization_id is null;

alter table projects alter column organization_id set not null;
alter table projects alter column mode set not null;
alter table projects alter column mode set default 'production';

alter table workflow_versions add column created_by uuid references auth.users(id) on delete set null;
alter table agent_builds add column requested_by uuid references auth.users(id) on delete set null;
alter table approval_requests add column requested_by uuid references auth.users(id) on delete set null;
alter table approval_actions add column actor_id uuid references auth.users(id) on delete set null;

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 120),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 1 and 200),
  key text not null check (char_length(key) between 8 and 255),
  response_status integer not null check (response_status between 100 and 599),
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  unique (actor_id, endpoint, key)
);

create index projects_organization_id_idx on projects(organization_id);
create index organization_memberships_user_id_idx on organization_memberships(user_id);
create index audit_events_organization_created_idx on audit_events(organization_id, created_at desc);
create index idempotency_keys_actor_created_idx on idempotency_keys(actor_id, created_at desc);

-- The bucket is intentionally private. Phase 2 will add direct upload URLs;
-- paths are already reserved as <organization-id>/<project-id>/<artifact-id>.
insert into storage.buckets (id, name, public)
values ('tacit-artifacts', 'tacit-artifacts', false)
on conflict (id) do update set public = false;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_organization_id and membership.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_organization(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_read_project(target_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.projects project
    join public.organization_memberships membership on membership.organization_id = project.organization_id
    where project.id = target_project_id and project.mode = 'production' and membership.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_project(target_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.projects project
    join public.organization_memberships membership on membership.organization_id = project.organization_id
    where project.id = target_project_id and project.mode = 'production' and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.can_read_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.observation_sessions session where session.id = target_session_id and public.can_read_project(session.project_id));
$$;

create or replace function public.can_write_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.observation_sessions session where session.id = target_session_id and public.can_write_project(session.project_id));
$$;

create or replace function public.can_read_workflow_version(target_workflow_version_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workflow_versions version where version.id = target_workflow_version_id and public.can_read_project(version.project_id));
$$;

create or replace function public.can_write_workflow_version(target_workflow_version_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workflow_versions version where version.id = target_workflow_version_id and public.can_write_project(version.project_id));
$$;

create or replace function public.can_read_build(target_build_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agent_builds build where build.id = target_build_id and public.can_read_project(build.project_id));
$$;

create or replace function public.can_write_build(target_build_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agent_builds build where build.id = target_build_id and public.can_write_project(build.project_id));
$$;

create or replace function public.can_read_approval(target_approval_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.approval_requests request where request.id = target_approval_id and public.can_read_project(request.project_id));
$$;

create or replace function public.can_write_approval(target_approval_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.approval_requests request where request.id = target_approval_id and public.can_write_project(request.project_id));
$$;

create or replace function public.can_read_test_run(target_test_run_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.test_runs run where run.id = target_test_run_id and public.can_read_project(run.project_id));
$$;

create or replace function public.can_write_test_run(target_test_run_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.test_runs run where run.id = target_test_run_id and public.can_write_project(run.project_id));
$$;

create or replace function public.can_read_artifact(object_name text)
returns boolean language sql stable security definer set search_path = public, storage as $$
  select case when (storage.foldername(object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                    and (storage.foldername(object_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then exists (
      select 1 from public.projects project
      where project.id = (storage.foldername(object_name))[2]::uuid
        and project.organization_id = (storage.foldername(object_name))[1]::uuid
        and public.can_read_project(project.id)
    ) else false end;
$$;

create or replace function public.can_write_artifact(object_name text)
returns boolean language sql stable security definer set search_path = public, storage as $$
  select case when (storage.foldername(object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                    and (storage.foldername(object_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then exists (
      select 1 from public.projects project
      where project.id = (storage.foldername(object_name))[2]::uuid
        and project.organization_id = (storage.foldername(object_name))[1]::uuid
        and public.can_write_project(project.id)
    ) else false end;
$$;

alter table organizations enable row level security;
alter table organization_memberships enable row level security;
alter table audit_events enable row level security;
alter table idempotency_keys enable row level security;

create policy organizations_select_member on organizations for select using (public.is_organization_member(id));
create policy organizations_insert_owner on organizations for insert with check (mode = 'production' and created_by = auth.uid());
create policy organizations_update_admin on organizations for update using (public.can_manage_organization(id)) with check (public.can_manage_organization(id));
create policy memberships_select_member on organization_memberships for select using (public.is_organization_member(organization_id));
create policy memberships_insert_admin on organization_memberships for insert with check (public.can_manage_organization(organization_id));
create policy memberships_update_admin on organization_memberships for update using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));
create policy memberships_delete_admin on organization_memberships for delete using (public.can_manage_organization(organization_id));
create policy audit_events_select_member on audit_events for select using (public.is_organization_member(organization_id));
create policy idempotency_keys_select_actor on idempotency_keys for select using (actor_id = auth.uid());

create policy projects_select_member on projects for select using (public.can_read_project(id));
create policy projects_insert_member on projects for insert with check (mode = 'production' and created_by = auth.uid() and public.is_organization_member(organization_id));
create policy projects_update_member on projects for update using (public.can_write_project(id)) with check (mode = 'production' and public.can_write_project(id));
create policy projects_delete_admin on projects for delete using (public.can_manage_organization(organization_id) and mode = 'production');

create policy observation_sessions_read on observation_sessions for select using (public.can_read_project(project_id));
create policy observation_sessions_write on observation_sessions for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy documents_read on documents for select using (public.can_read_project(project_id));
create policy documents_write on documents for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy workflow_events_read on workflow_events for select using (public.can_read_session(observation_session_id));
create policy workflow_events_write on workflow_events for all using (public.can_write_session(observation_session_id)) with check (public.can_write_session(observation_session_id));
create policy workflow_versions_read on workflow_versions for select using (public.can_read_project(project_id));
create policy workflow_versions_write on workflow_versions for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy decision_rules_read on decision_rules for select using (public.can_read_workflow_version(workflow_version_id));
create policy decision_rules_write on decision_rules for all using (public.can_write_workflow_version(workflow_version_id)) with check (public.can_write_workflow_version(workflow_version_id));
create policy clarification_questions_read on clarification_questions for select using (public.can_read_workflow_version(workflow_version_id));
create policy clarification_questions_write on clarification_questions for all using (public.can_write_workflow_version(workflow_version_id)) with check (public.can_write_workflow_version(workflow_version_id));
create policy agent_builds_read on agent_builds for select using (public.can_read_project(project_id));
create policy agent_builds_write on agent_builds for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy agent_build_logs_read on agent_build_logs for select using (public.can_read_build(agent_build_id));
create policy agent_build_logs_write on agent_build_logs for all using (public.can_write_build(agent_build_id)) with check (public.can_write_build(agent_build_id));
create policy test_cases_read on test_cases for select using (public.can_read_project(project_id));
create policy test_cases_write on test_cases for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy test_runs_read on test_runs for select using (public.can_read_project(project_id));
create policy test_runs_write on test_runs for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy test_case_results_read on test_case_results for select using (public.can_read_test_run(test_run_id));
create policy test_case_results_write on test_case_results for all using (public.can_write_test_run(test_run_id)) with check (public.can_write_test_run(test_run_id));
create policy approval_requests_read on approval_requests for select using (public.can_read_project(project_id));
create policy approval_requests_write on approval_requests for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy approval_actions_read on approval_actions for select using (public.can_read_approval(approval_request_id));
create policy approval_actions_write on approval_actions for all using (public.can_write_approval(approval_request_id)) with check (public.can_write_approval(approval_request_id));
create policy impact_snapshots_read on impact_snapshots for select using (public.can_read_project(project_id));
create policy impact_snapshots_write on impact_snapshots for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy invoice_exception_records_read on invoice_exception_records for select using (public.can_read_project(project_id));
create policy invoice_exception_records_write on invoice_exception_records for all using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));
create policy workflow_rule_diffs_read on workflow_rule_diffs for select using (public.can_read_workflow_version(workflow_version_id));
create policy workflow_rule_diffs_write on workflow_rule_diffs for all using (public.can_write_workflow_version(workflow_version_id)) with check (public.can_write_workflow_version(workflow_version_id));

create policy artifacts_select_member on storage.objects for select using (
  bucket_id = 'tacit-artifacts' and public.can_read_artifact(name)
);
create policy artifacts_insert_writer on storage.objects for insert with check (
  bucket_id = 'tacit-artifacts' and public.can_write_artifact(name)
);
create policy artifacts_update_writer on storage.objects for update using (
  bucket_id = 'tacit-artifacts' and public.can_write_artifact(name)
) with check (
  bucket_id = 'tacit-artifacts' and public.can_write_artifact(name)
);
create policy artifacts_delete_writer on storage.objects for delete using (
  bucket_id = 'tacit-artifacts' and public.can_write_artifact(name)
);
