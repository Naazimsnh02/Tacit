-- Use the named unique constraint so PL/pgSQL output-column variables cannot
-- collide with the conflict-target column names.

create or replace function public.claim_source_intelligence_job()
returns table (
  job_id uuid,
  attempts integer,
  project_id uuid,
  kind text,
  payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    update public.platform_jobs job
    set status = 'running', attempts = job.attempts + 1, started_at = now(), updated_at = now()
    where job.id = (
      select candidate.id
      from public.platform_jobs candidate
      where candidate.status = 'queued'
        and candidate.attempts < 5
        and candidate.available_at <= now()
        and candidate.kind in ('source_interpretation', 'cross_source_understanding')
        and (
          candidate.kind = 'source_interpretation'
          or not exists (
            select 1
            from public.platform_jobs source_job
            where source_job.project_id = candidate.project_id
              and source_job.kind = 'source_interpretation'
              and source_job.status in ('queued', 'running')
          )
        )
      order by case candidate.kind when 'source_interpretation' then 0 else 1 end,
               candidate.available_at, candidate.created_at
      for update skip locked
      limit 1
    )
    returning job.id, job.attempts, job.project_id, job.kind, job.payload
  ), recorded as (
    insert into public.platform_job_attempts (job_id, project_id, attempt, status)
    select claimed.id, claimed.project_id, claimed.attempts, 'running' from claimed
    on conflict on constraint platform_job_attempts_job_id_attempt_key do update
      set status = 'running', error_message = null, started_at = now(), completed_at = null
  )
  select claimed.id, claimed.attempts, claimed.project_id, claimed.kind, claimed.payload
  from claimed;
end;
$$;

revoke all on function public.claim_source_intelligence_job() from public, anon, authenticated;
grant execute on function public.claim_source_intelligence_job() to service_role;
