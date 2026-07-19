-- Process-aware source intelligence and package synthesis.
-- Additive: expands insight/job kinds and claim ordering so interpretation
-- can extract process structure and assemble a domain-agnostic package draft.

alter table public.evidence_insights
  drop constraint if exists evidence_insights_kind_check;

alter table public.evidence_insights
  add constraint evidence_insights_kind_check check (kind in (
    'source_classification',
    'summary',
    'entity',
    'fact',
    'table_structure',
    'system_context',
    'source_role',
    'process_objective',
    'process_step',
    'process_decision',
    'threshold',
    'actor',
    'exception',
    'never_automate',
    'case_field',
    'package_objective',
    'package_primary_case',
    'package_policy_rule',
    'package_case_fact',
    'package_suggested_step',
    'package_missing',
    'package_never_automate',
    'package_contradiction'
  ));

alter table public.platform_jobs
  drop constraint if exists platform_jobs_kind_check;

alter table public.platform_jobs
  add constraint platform_jobs_kind_check check (kind in (
    'source_interpretation',
    'cross_source_understanding',
    'package_synthesis',
    'test_plan',
    'readiness_review',
    'operating_analysis'
  ));

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
declare
  stale_after interval := interval '20 minutes';
begin
  -- Release abandoned running jobs so they become claimable again.
  update public.platform_jobs job
  set status = 'queued',
      available_at = now(),
      updated_at = now(),
      error_message = coalesce(job.error_message, 'Worker interrupted; reclaimed for retry.')
  where job.status = 'running'
    and job.kind in ('source_interpretation', 'cross_source_understanding', 'package_synthesis')
    and job.started_at is not null
    and job.started_at < now() - stale_after
    and job.attempts < 5;

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
        and candidate.kind in ('source_interpretation', 'cross_source_understanding', 'package_synthesis')
        and (
          candidate.kind = 'source_interpretation'
          or (
            candidate.kind = 'cross_source_understanding'
            and not exists (
              select 1
              from public.platform_jobs source_job
              where source_job.project_id = candidate.project_id
                and source_job.kind = 'source_interpretation'
                and source_job.status in ('queued', 'running')
            )
          )
          or (
            candidate.kind = 'package_synthesis'
            and not exists (
              select 1
              from public.platform_jobs prior_job
              where prior_job.project_id = candidate.project_id
                and prior_job.kind in ('source_interpretation', 'cross_source_understanding')
                and prior_job.status in ('queued', 'running')
            )
          )
        )
      order by case candidate.kind
                 when 'source_interpretation' then 0
                 when 'cross_source_understanding' then 1
                 else 2
               end,
               candidate.available_at,
               candidate.created_at
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
