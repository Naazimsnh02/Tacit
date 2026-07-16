-- Phase 2: tenant-owned source artifacts, extraction provenance, and queued ingestion.
-- Binary files remain private in tacit-artifacts under
-- <organization-id>/<project-id>/<artifact-id>/source/<sanitized-filename>.

create table evidence_artifacts (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete restrict,
  evidence_type text not null check (evidence_type in ('sop', 'document', 'spreadsheet', 'image', 'audio', 'video')),
  filename text not null check (char_length(filename) between 1 and 255),
  display_name text not null check (char_length(display_name) between 1 and 255),
  media_type text not null check (char_length(media_type) between 1 and 160),
  byte_size bigint not null check (byte_size > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  storage_key text not null unique,
  storage_version text,
  status text not null check (status in ('uploading', 'queued', 'processing', 'ready', 'failed', 'deleted')),
  scan_status text not null check (scan_status in ('pending', 'clean', 'blocked', 'failed')),
  processing_consent_at timestamptz not null,
  retention_expires_at timestamptz,
  failure_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'deleted') = (deleted_at is not null)),
  check ((status = 'failed') = (failure_reason is not null) or status <> 'failed')
);

create table evidence_extractions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references evidence_artifacts(id) on delete cascade,
  kind text not null check (kind in ('text', 'ocr', 'transcript', 'frame', 'spreadsheet')),
  content text not null check (char_length(content) > 0),
  page_start integer check (page_start > 0),
  page_end integer check (page_end > 0),
  time_start_ms bigint check (time_start_ms >= 0),
  time_end_ms bigint check (time_end_ms >= 0),
  confidence numeric not null check (confidence between 0 and 1),
  source_artifact_version text not null,
  created_at timestamptz not null default now(),
  check (page_end is null or page_start is not null),
  check (page_end is null or page_end >= page_start),
  check (time_end_ms is null or time_start_ms is not null),
  check (time_end_ms is null or time_end_ms >= time_start_ms)
);

create table evidence_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references evidence_artifacts(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'failed') = (error_code is not null)),
  check ((status in ('succeeded', 'failed', 'cancelled')) = (completed_at is not null))
);

create unique index evidence_ingestion_jobs_active_artifact_idx on evidence_ingestion_jobs(artifact_id) where status in ('queued', 'running');
create index evidence_artifacts_project_created_idx on evidence_artifacts(project_id, created_at desc);
create index evidence_extractions_artifact_created_idx on evidence_extractions(artifact_id, created_at);
create index evidence_extractions_search_idx on evidence_extractions using gin (to_tsvector('simple', content));
create index evidence_ingestion_jobs_queue_idx on evidence_ingestion_jobs(status, available_at) where status = 'queued';

create or replace function private.evidence_artifact_matches_project(target_artifact_id uuid, target_project_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.evidence_artifacts artifact
    where artifact.id = target_artifact_id
      and artifact.project_id = target_project_id
      and artifact.organization_id = (select project.organization_id from public.projects project where project.id = target_project_id)
  );
$$;

create or replace function private.can_read_evidence_artifact(target_artifact_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.evidence_artifacts artifact where artifact.id = target_artifact_id and private.can_read_project(artifact.project_id));
$$;

create or replace function private.can_write_evidence_artifact(target_artifact_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.evidence_artifacts artifact where artifact.id = target_artifact_id and private.can_write_project(artifact.project_id));
$$;

grant execute on function private.evidence_artifact_matches_project(uuid, uuid), private.can_read_evidence_artifact(uuid), private.can_write_evidence_artifact(uuid) to authenticated;

alter table evidence_artifacts enable row level security;
alter table evidence_extractions enable row level security;
alter table evidence_ingestion_jobs enable row level security;

create policy evidence_artifacts_read on evidence_artifacts for select using (private.can_read_project(project_id));
create policy evidence_artifacts_insert on evidence_artifacts for insert with check (
  status = 'uploading' and scan_status = 'pending' and private.can_write_project(project_id)
  and organization_id = (select project.organization_id from projects project where project.id = evidence_artifacts.project_id)
);
create policy evidence_artifacts_update on evidence_artifacts for update using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
create policy evidence_extractions_read on evidence_extractions for select using (private.can_read_evidence_artifact(artifact_id));
create policy evidence_ingestion_jobs_read on evidence_ingestion_jobs for select using (private.can_read_evidence_artifact(artifact_id));

create policy evidence_artifacts_storage_read on storage.objects for select using (
  bucket_id = 'tacit-artifacts' and exists (
    select 1 from public.evidence_artifacts artifact
    where artifact.storage_key = name and artifact.status <> 'deleted' and private.can_read_project(artifact.project_id)
  )
);
create policy evidence_artifacts_storage_insert on storage.objects for insert with check (
  bucket_id = 'tacit-artifacts' and exists (
    select 1 from public.evidence_artifacts artifact
    where artifact.storage_key = name and artifact.status = 'uploading' and private.can_write_project(artifact.project_id)
  )
);
create policy evidence_artifacts_storage_delete on storage.objects for delete using (
  bucket_id = 'tacit-artifacts' and exists (
    select 1 from public.evidence_artifacts artifact
    where artifact.storage_key = name and private.can_write_project(artifact.project_id)
  )
);
