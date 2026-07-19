import { z } from 'zod';
import { authenticateRequest, enforceRateLimit, errorResponse, mapProject, organizationRoleFor, serviceRequest, ApiError } from '../../../../../lib/platform/api';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';

type Row = Record<string, unknown>;

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, actor] = await Promise.all([context.params, authenticateRequest(request)]);
    z.string().uuid().parse(projectId); enforceRateLimit(actor.id, 'observation:read', 60);
    const rows = await serviceRequest<Row[]>(`projects?id=eq.${encodeURIComponent(projectId)}&mode=eq.production&select=*&limit=1`);
    const row = rows[0]; if (!row) throw new ApiError(404, 'Production project not found.');
    const project = mapProject(row);
    if (!await organizationRoleFor(actor.id, project.organizationId)) throw new ApiError(403, 'You do not have access to this project.');
    const pack = createWorkflowRegistry().get(project.workflowType);
    const [extractions, confirmations] = await Promise.all([
      serviceRequest<Row[]>(`evidence_extractions?select=id,kind,page_start,page_end,time_start_ms,time_end_ms,evidence_artifacts!inner(project_id,display_name,status,scan_status)&evidence_artifacts.project_id=eq.${encodeURIComponent(projectId)}&evidence_artifacts.status=eq.ready&evidence_artifacts.scan_status=eq.clean&order=created_at.asc`),
      serviceRequest<Row[]>(`workflow_confirmations?project_id=eq.${encodeURIComponent(projectId)}&select=workflow_version_id,created_at&order=created_at.desc&limit=1`),
    ]);
    const confirmedWorkflowVersionId = confirmations[0]?.workflow_version_id;
    return Response.json({
      project: { id: project.id, name: project.name, workflowType: project.workflowType },
      workflow: {
        name: pack.name,
        workspace: pack.workspaceDefinition,
        confirmedVersionId: typeof confirmedWorkflowVersionId === 'string' ? confirmedWorkflowVersionId : null,
      },
      evidence: extractions.map((extraction) => {
        const artifact = extraction.evidence_artifacts as Row;
        const range = extraction.page_start !== null ? `Page ${String(extraction.page_start)}${extraction.page_end && extraction.page_end !== extraction.page_start ? `-${String(extraction.page_end)}` : ''}` : extraction.time_start_ms !== null ? `${Math.floor(Number(extraction.time_start_ms) / 1000)}s` : String(extraction.kind);
        return { id: String(extraction.id), title: String(artifact.display_name), detail: `${String(extraction.kind)} · ${range}` };
      }),
    });
  } catch (error) { return errorResponse(error); }
}
