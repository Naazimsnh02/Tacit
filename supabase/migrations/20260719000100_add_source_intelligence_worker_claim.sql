-- Multimodal source intelligence remains a post-scan, service-worker-only step.
-- `visual` permits a citeable image source even when OCR finds no readable text.

alter table evidence_extractions drop constraint evidence_extractions_kind_check;
alter table evidence_extractions add constraint evidence_extractions_kind_check
  check (kind in ('text', 'ocr', 'transcript', 'frame', 'spreadsheet', 'visual'));

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
    set status = 'running', attempts = job.attempts + 1, started_at = now(), updated_at = now(), error_message = null
    where job.id = (
      select candidate.id
      from public.platform_jobs candidate
      where candidate.status = 'queued'
        and candidate.available_at <= now()
        and candidate.kind in ('source_interpretation', 'cross_source_understanding')
        and (
          candidate.kind = 'source_interpretation'
          or not exists (
            select 1 from public.platform_jobs source_job
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
  )
  select claimed.id, claimed.attempts, claimed.project_id, claimed.kind, claimed.payload
  from claimed;
end;
$$;

revoke all on function public.claim_source_intelligence_job() from public, anon, authenticated;
grant execute on function public.claim_source_intelligence_job() to service_role;
