-- Evidence metadata is immutable to authenticated clients after creation.
-- The authenticated application API performs status transitions with the service role
-- only after checksum verification, scanner results, and worker processing.
drop policy evidence_artifacts_insert on evidence_artifacts;
drop policy evidence_artifacts_update on evidence_artifacts;
