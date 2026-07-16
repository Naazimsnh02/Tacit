-- A worker-safe, atomic queue claim. It is intentionally executable only by
-- service_role; customer sessions can read their job status but cannot run work.
create or replace function public.claim_evidence_ingestion_job()
returns table (
  job_id uuid,
  attempts integer,
  artifact_id uuid,
  project_id uuid,
  organization_id uuid,
  evidence_type text,
  filename text,
  media_type text,
  storage_key text,
  storage_version text,
  checksum_sha256 text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    update public.evidence_ingestion_jobs job
    set status = 'running', attempts = job.attempts + 1, started_at = now(), updated_at = now()
    where job.id = (
      select candidate.id
      from public.evidence_ingestion_jobs candidate
      join public.evidence_artifacts artifact on artifact.id = candidate.artifact_id
      where candidate.status = 'queued' and candidate.available_at <= now()
        and artifact.status = 'queued' and artifact.scan_status = 'pending'
        and (artifact.retention_expires_at is null or artifact.retention_expires_at > now())
      order by candidate.available_at, candidate.created_at
      for update skip locked
      limit 1
    )
    returning job.id, job.attempts, job.artifact_id
  )
  select claimed.id, claimed.attempts, artifact.id, artifact.project_id, artifact.organization_id,
         artifact.evidence_type, artifact.filename, artifact.media_type, artifact.storage_key,
         artifact.storage_version, artifact.checksum_sha256
  from claimed
  join public.evidence_artifacts artifact on artifact.id = claimed.artifact_id;
end;
$$;

revoke all on function public.claim_evidence_ingestion_job() from public, anon, authenticated;
grant execute on function public.claim_evidence_ingestion_job() to service_role;
