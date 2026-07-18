# Invoice pilot operations

Tacit Phase 6 launches Invoice Exception Review as a supervised pilot. It never releases a payment or performs another financial side effect: recommendations stop at the approval queue, where an authenticated project member records the decision.

## Pilot onboarding

1. Create a production organization and Invoice Exception Review project.
2. Upload the SOP and review recording with processing consent.
3. Wait for clean, extracted evidence; retry only failed intake jobs.
4. Record evidence-linked SME observations, resolve clarifications, and confirm the workflow.
5. Review the generated build and promote a passed build. Replay labelled cases to persist observed quality metrics and a clearly labelled impact snapshot.
6. Explicitly run an evidence-linked supervised case for a high-risk recommendation. A workflow-pack human-review outcome creates an approval request; replay itself never creates approval work.

The default cap is five active production projects per organization. Set `PILOT_MAX_ACTIVE_PROJECTS_PER_ORGANIZATION` to a whole number from 1 to 100 before deployment. Archive a project or contact support when the cap is reached.

## Support diagnostics and monitoring

- Start with `GET /api/health`, the web deployment health check, runtime `/health`, and Supabase Auth, Storage, and database logs.
- Treat failed uploads, failed evidence scans/extractions, reconstruction validation failures, build failures, sandbox rejections, replay failures, and approval-decision persistence failures as support events. Preserve project ID, artifact/build/run ID, timestamp, and the user-visible error; do not copy uploaded content or secrets into a ticket.
- Alert on repeated health-check failures, ingestion jobs that remain claimed or pending beyond their worker SLA, build/replay failure spikes, sandbox policy rejections, and database/storage authentication failures.
- Review pilot accuracy, review rate, and unsafe-failure rate from persisted replay results before expanding access. Do not enable autonomous actions based on estimates.

## Incident response and backups

1. Acknowledge the incident, stop affected builds or intake jobs, and preserve the audit trail.
2. Scope affected organizations/projects without exposing cross-tenant data.
3. Rotate any potentially exposed secret, revoke affected signed URLs, and notify impacted pilot contacts through the approved support channel.
4. Restore only from verified, encrypted database and object-storage backups; validate RLS and an evidence-to-approval smoke path after restore.
5. Record root cause, impact, remediation, and follow-up owner in the incident log.

The deployment owner verifies automated database backups and object-storage recovery at least quarterly. Staging and production use separate Supabase projects and secrets.

## Privacy, retention, and deletion

Only authorized organization members can access production project evidence. Uploaded source files are private, versioned, checksum-verified, and linked to extracted citations. Evidence deletion removes the storage object and derived extractions; the artifact record is retained as a deleted audit marker. Retention is selected at upload and must not exceed the stated customer agreement.

Before onboarding, give pilot users the applicable privacy terms, recording/processing consent language, retention setting, and support contact. A deletion request must be authenticated, scoped to the project, confirmed by an authorized member, and logged without retaining the deleted payload.
