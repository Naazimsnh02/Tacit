import { z } from 'zod';
import { ApiError, authenticateRequest, canWrite, enforceRateLimit, errorResponse, organizationRoleFor, serviceRequest } from '../../../../../../../lib/platform/api';

type ArtifactRow = { id: string; organization_id: string; status: string };

export async function POST(request: Request, context: { params: Promise<{ projectId: string; artifactId: string }> }) {
  try {
    const [{ projectId, artifactId }, actor] = await Promise.all([context.params, authenticateRequest(request)]);
    z.string().uuid().parse(projectId); z.string().uuid().parse(artifactId); enforceRateLimit(actor.id, 'evidence:retry', 10);
    const rows = await serviceRequest<ArtifactRow[]>(`evidence_artifacts?id=eq.${encodeURIComponent(artifactId)}&project_id=eq.${encodeURIComponent(projectId)}&status=eq.failed&select=id,organization_id,status&limit=1`);
    const artifact = rows[0]; if (!artifact) throw new ApiError(404, 'A failed evidence artifact was not found.');
    if (!canWrite(await organizationRoleFor(actor.id, artifact.organization_id))) throw new ApiError(403, 'You do not have permission to retry this evidence.');
    await Promise.all([
      serviceRequest(`evidence_artifacts?id=eq.${encodeURIComponent(artifactId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'queued', scan_status: 'pending', failure_reason: null, updated_at: new Date().toISOString() }) }),
      serviceRequest('evidence_ingestion_jobs', { method: 'POST', body: JSON.stringify([{ artifact_id: artifactId, status: 'queued' }]) }),
      serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: artifact.organization_id, project_id: projectId, actor_id: actor.id, event_type: 'evidence.retry_queued', payload: { artifactId } }]) }),
    ]);
    return Response.json({ ok: true, status: 'queued' }, { status: 202 });
  } catch (error) { return errorResponse(error); }
}
