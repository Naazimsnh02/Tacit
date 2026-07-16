import { NextResponse } from 'next/server';
import { createWorkflowGraph } from '../../../../../lib/workflow-graph/model';
import { SupabaseWorkflowGraphRepository } from '../../../../../lib/workflow-graph/repository';
import { authorizeProjectRequest, errorResponse, serviceRequest } from '../../../../../lib/platform/api';

export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await context.params;
    const rows = await serviceRequest<Array<{ project_id: string }>>(`workflow_versions?id=eq.${encodeURIComponent(versionId)}&select=project_id&limit=1`);
    if (rows[0]) await authorizeProjectRequest(request, rows[0].project_id);
    const reconstruction = await new SupabaseWorkflowGraphRepository().getReconstruction(versionId);
    if (!reconstruction) return NextResponse.json({ error: 'Workflow version not found.' }, { status: 404 });
    return NextResponse.json(createWorkflowGraph(reconstruction));
  } catch (error) {
    return errorResponse(error);
  }
}
