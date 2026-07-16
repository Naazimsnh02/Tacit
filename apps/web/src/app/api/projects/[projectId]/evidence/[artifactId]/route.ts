import { z } from 'zod';
import { authenticateRequest, canWrite, enforceRateLimit, errorResponse, organizationRoleFor, serviceRequest, serviceSupabaseConfig, ApiError } from '../../../../../../lib/platform/api';

type ArtifactRow = { id: string; organization_id: string; storage_key: string; status: string };
export async function DELETE(request: Request, context: { params: Promise<{ projectId: string; artifactId: string }> }) {
  try {
    const [{ projectId, artifactId }, actor] = await Promise.all([context.params, authenticateRequest(request)]); z.string().uuid().parse(projectId); z.string().uuid().parse(artifactId); enforceRateLimit(actor.id, 'evidence:delete', 20);
    const rows = await serviceRequest<ArtifactRow[]>(`evidence_artifacts?id=eq.${encodeURIComponent(artifactId)}&project_id=eq.${encodeURIComponent(projectId)}&status=neq.deleted&select=id,organization_id,storage_key,status&limit=1`);
    const artifact = rows[0]; if (!artifact) throw new ApiError(404, 'Evidence artifact not found.');
    if (!canWrite(await organizationRoleFor(actor.id, artifact.organization_id))) throw new ApiError(403, 'You do not have permission to delete this evidence.');
    const config = serviceSupabaseConfig(); const deletion = await fetch(`${config.url}/storage/v1/object/tacit-artifacts`, { method: 'DELETE', headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [artifact.storage_key] }) });
    if (!deletion.ok) throw new ApiError(502, 'The stored evidence could not be deleted.');
    await Promise.all([
      serviceRequest(`evidence_artifacts?id=eq.${encodeURIComponent(artifactId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'deleted', deleted_at: new Date().toISOString() }) }),
      serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: artifact.organization_id, project_id: projectId, actor_id: actor.id, event_type: 'evidence.deleted', payload: { artifactId } }]) }),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
