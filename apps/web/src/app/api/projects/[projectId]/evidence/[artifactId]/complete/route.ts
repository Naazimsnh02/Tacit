import { z } from 'zod';
import { authenticateRequest, canWrite, enforceRateLimit, errorResponse, organizationRoleFor, serviceRequest, serviceSupabaseConfig, ApiError } from '../../../../../../../lib/platform/api';
import { completeUploadSchema, inspectUploadedResponse, validateFileSignature } from '../../../../../../../lib/evidence/service';

type ArtifactRow = { id: string; project_id: string; organization_id: string; storage_key: string; media_type: string; checksum_sha256: string; status: string };
function objectPath(key: string): string { return key.split('/').map(encodeURIComponent).join('/'); }

export async function POST(request: Request, context: { params: Promise<{ projectId: string; artifactId: string }> }) {
  try {
    const [{ projectId, artifactId }, actor, body] = await Promise.all([context.params, authenticateRequest(request), request.json()]); z.string().uuid().parse(projectId); z.string().uuid().parse(artifactId);
    const payload = completeUploadSchema.parse(body); enforceRateLimit(actor.id, 'evidence:complete', 20);
    const rows = await serviceRequest<ArtifactRow[]>(`evidence_artifacts?id=eq.${encodeURIComponent(artifactId)}&project_id=eq.${encodeURIComponent(projectId)}&status=eq.uploading&select=id,project_id,organization_id,storage_key,media_type,checksum_sha256,status&limit=1`);
    const artifact = rows[0]; if (!artifact) throw new ApiError(404, 'Pending evidence upload not found.');
    if (!canWrite(await organizationRoleFor(actor.id, artifact.organization_id))) throw new ApiError(403, 'You do not have permission to complete this upload.');
    if (payload.checksumSha256 !== artifact.checksum_sha256) throw new ApiError(400, 'The upload checksum does not match the prepared evidence record.');
    const config = serviceSupabaseConfig(); const object = await fetch(`${config.url}/storage/v1/object/tacit-artifacts/${objectPath(artifact.storage_key)}`, { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` }, cache: 'no-store' });
    const inspected = await inspectUploadedResponse(object);
    if (inspected.checksumSha256 !== artifact.checksum_sha256 || !validateFileSignature(artifact.media_type, inspected.signature)) {
      await serviceRequest(`evidence_artifacts?id=eq.${encodeURIComponent(artifactId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', scan_status: 'blocked', failure_reason: 'The uploaded file did not match its declared checksum or file type.' }) });
      throw new ApiError(400, 'The uploaded file could not be verified.');
    }
    await Promise.all([
      serviceRequest(`evidence_artifacts?id=eq.${encodeURIComponent(artifactId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'queued', storage_version: inspected.storageVersion }) }),
      serviceRequest('evidence_ingestion_jobs', { method: 'POST', body: JSON.stringify([{ artifact_id: artifactId, status: 'queued' }]) }),
      serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: artifact.organization_id, project_id: projectId, actor_id: actor.id, event_type: 'evidence.upload_completed', payload: { artifactId } }]) }),
    ]);
    return Response.json({ ok: true, status: 'queued' }, { status: 202 });
  } catch (error) { return errorResponse(error); }
}
