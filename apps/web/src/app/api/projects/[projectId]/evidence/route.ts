import { z } from 'zod';
import { authenticateRequest, canWrite, enforceRateLimit, errorResponse, organizationRoleFor, serviceRequest, serviceSupabaseConfig, ApiError } from '../../../../../lib/platform/api';
import { buildEvidenceStorageKey, createEvidenceArtifactId, uploadRequestSchema, validateUpload } from '../../../../../lib/evidence/service';

type ProjectRow = { id: string; organization_id: string; mode: string };
type ArtifactRow = Record<string, unknown>;

function pathPart(value: string): string { return value.split('/').map(encodeURIComponent).join('/'); }
function mapArtifact(row: ArtifactRow) {
  return {
    id: String(row.id), projectId: String(row.project_id), organizationId: String(row.organization_id), evidenceType: String(row.evidence_type),
    filename: String(row.filename), displayName: String(row.display_name), mediaType: String(row.media_type), byteSize: Number(row.byte_size),
    checksumSha256: String(row.checksum_sha256), storageKey: String(row.storage_key), storageVersion: row.storage_version === null ? null : String(row.storage_version),
    status: String(row.status), scanStatus: String(row.scan_status), processingConsentAt: String(row.processing_consent_at),
    retentionExpiresAt: row.retention_expires_at === null ? null : String(row.retention_expires_at), failureReason: row.failure_reason === null ? null : String(row.failure_reason),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

async function writableProject(projectId: string, actorId: string): Promise<ProjectRow> {
  const rows = await serviceRequest<ProjectRow[]>(`projects?id=eq.${encodeURIComponent(projectId)}&mode=eq.production&select=id,organization_id,mode&limit=1`);
  const project = rows[0]; if (!project) throw new ApiError(404, 'Production project not found.');
  if (!canWrite(await organizationRoleFor(actorId, project.organization_id))) throw new ApiError(403, 'You do not have permission to upload evidence to this project.');
  return project;
}
async function readableProject(projectId: string, actorId: string): Promise<ProjectRow> {
  const rows = await serviceRequest<ProjectRow[]>(`projects?id=eq.${encodeURIComponent(projectId)}&mode=eq.production&select=id,organization_id,mode&limit=1`);
  const project = rows[0]; if (!project) throw new ApiError(404, 'Production project not found.');
  if (!await organizationRoleFor(actorId, project.organization_id)) throw new ApiError(403, 'You do not have access to this project.');
  return project;
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, actor] = await Promise.all([context.params, authenticateRequest(request)]); z.string().uuid().parse(projectId);
    await readableProject(projectId, actor.id); enforceRateLimit(actor.id, 'evidence:list', 60);
    const artifacts = await serviceRequest<ArtifactRow[]>(`evidence_artifacts?project_id=eq.${encodeURIComponent(projectId)}&status=neq.deleted&select=*&order=created_at.desc`);
    const ids = artifacts.map(({ id }) => String(id));
    const extractions = ids.length ? await serviceRequest<ArtifactRow[]>(`evidence_extractions?artifact_id=in.(${ids.map(encodeURIComponent).join(',')})&select=*&order=created_at.asc`) : [];
    return Response.json({ artifacts: artifacts.map(mapArtifact), extractions: extractions.map((row) => ({ id: String(row.id), artifactId: String(row.artifact_id), kind: String(row.kind), content: String(row.content), pageStart: row.page_start === null ? null : Number(row.page_start), pageEnd: row.page_end === null ? null : Number(row.page_end), timeStartMs: row.time_start_ms === null ? null : Number(row.time_start_ms), timeEndMs: row.time_end_ms === null ? null : Number(row.time_end_ms), confidence: Number(row.confidence), sourceArtifactVersion: String(row.source_artifact_version), createdAt: String(row.created_at) })) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, actor, body] = await Promise.all([context.params, authenticateRequest(request), request.json()]); z.string().uuid().parse(projectId);
    const project = await writableProject(projectId, actor.id); enforceRateLimit(actor.id, 'evidence:create', 20);
    const input = uploadRequestSchema.parse(body); const { filename } = validateUpload(input); const artifactId = createEvidenceArtifactId();
    const storageKey = buildEvidenceStorageKey(project.organization_id, projectId, artifactId, filename);
    const retentionExpiresAt = input.retentionDays ? new Date(Date.now() + input.retentionDays * 86_400_000).toISOString() : null;
    const [artifact] = await serviceRequest<ArtifactRow[]>('evidence_artifacts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ id: artifactId, project_id: projectId, organization_id: project.organization_id, evidence_type: input.evidenceType, filename, display_name: filename, media_type: input.mediaType.toLowerCase(), byte_size: input.byteSize, checksum_sha256: input.checksumSha256, storage_key: storageKey, status: 'uploading', scan_status: 'pending', processing_consent_at: new Date().toISOString(), retention_expires_at: retentionExpiresAt }]) });
    const config = serviceSupabaseConfig();
    const signed = await fetch(`${config.url}/storage/v1/object/upload/sign/tacit-artifacts/${pathPart(storageKey)}`, { method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    if (!signed.ok) throw new ApiError(502, 'A signed upload URL could not be created.');
    const signedBody = await signed.json() as { url?: unknown; token?: unknown };
    if (typeof signedBody.url !== 'string' || typeof signedBody.token !== 'string') throw new ApiError(502, 'A signed upload URL could not be created.');
    const signedUrl = signedBody.url.startsWith('http') ? signedBody.url : `${config.url}/storage/v1${signedBody.url}`;
    return Response.json({ artifact: mapArtifact(artifact), signedUrl, uploadToken: signedBody.token, expiresInSeconds: 7200 }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
