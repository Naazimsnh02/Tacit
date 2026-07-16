-- Keep SECURITY DEFINER RLS helpers out of Supabase's exposed RPC schema.
create schema if not exists private;

alter function public.is_organization_member(uuid) set schema private;
alter function public.can_manage_organization(uuid) set schema private;
alter function public.can_read_project(uuid) set schema private;
alter function public.can_write_project(uuid) set schema private;
alter function public.can_read_session(uuid) set schema private;
alter function public.can_write_session(uuid) set schema private;
alter function public.can_read_workflow_version(uuid) set schema private;
alter function public.can_write_workflow_version(uuid) set schema private;
alter function public.can_read_build(uuid) set schema private;
alter function public.can_write_build(uuid) set schema private;
alter function public.can_read_approval(uuid) set schema private;
alter function public.can_write_approval(uuid) set schema private;
alter function public.can_read_test_run(uuid) set schema private;
alter function public.can_write_test_run(uuid) set schema private;
alter function public.can_read_artifact(text) set schema private;
alter function public.can_write_artifact(text) set schema private;

revoke all on schema private from public;
revoke all on all functions in schema private from public, anon, authenticated;
