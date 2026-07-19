import { NextResponse } from 'next/server';
import { latestWorkflowVersion } from '../../../../../lib/ai-first/repository';
import { planSourceDerivedTests } from '../../../../../lib/ai-first/service';
import { authorizeProjectRequest, errorResponse, serviceRequest } from '../../../../../lib/platform/api';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params; await authorizeProjectRequest(request, projectId);
    const workflow = await latestWorkflowVersion(projectId); if (!workflow) return NextResponse.json({ error: 'Create a workflow draft before planning tests.' }, { status: 404 });
    const cases = await serviceRequest<Array<{ id: string }>>(`test_cases?project_id=eq.${encodeURIComponent(projectId)}&select=id`);
    return NextResponse.json({ workflowVersionId: workflow.id, tests: planSourceDerivedTests(workflow.specification, cases.length) });
  } catch (error) { return errorResponse(error); }
}
