import { z } from 'zod';
import { ApiError, authorizeProjectRequest, errorResponse, serviceRequest } from '../../../../../lib/platform/api';

type Row = Record<string, unknown>;

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const access = await authorizeProjectRequest(request, z.string().uuid().parse(projectId));
    if (access.mode !== 'production') throw new ApiError(404, 'Production project not found.');
    const [versions, confirmations, projectRows] = await Promise.all([
      serviceRequest<Row[]>(`workflow_versions?project_id=eq.${encodeURIComponent(projectId)}&select=id&order=version.desc&limit=1`),
      serviceRequest<Row[]>(`workflow_confirmations?project_id=eq.${encodeURIComponent(projectId)}&select=workflow_version_id&order=created_at.desc&limit=1`),
      serviceRequest<Row[]>(`projects?id=eq.${encodeURIComponent(projectId)}&select=name&limit=1`),
    ]);
    return Response.json({
      projectName: typeof projectRows[0]?.name === 'string' ? projectRows[0].name : undefined,
      workflowVersionId: typeof versions[0]?.id === 'string' ? versions[0].id : undefined,
      confirmedWorkflowVersionId: typeof confirmations[0]?.workflow_version_id === 'string' ? confirmations[0].workflow_version_id : undefined,
    });
  } catch (error) { return errorResponse(error); }
}
