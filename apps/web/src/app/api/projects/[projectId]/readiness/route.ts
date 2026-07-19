import { NextResponse } from 'next/server';
import { countOpenClarifications, latestReplayAccuracy, latestWorkflowVersion, saveReadiness } from '../../../../../lib/ai-first/repository';
import { recommendDeploymentMode } from '../../../../../lib/ai-first/service';
import { authorizeProjectRequest, errorResponse } from '../../../../../lib/platform/api';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params; await authorizeProjectRequest(request, projectId); const workflow = await latestWorkflowVersion(projectId);
    if (!workflow) return NextResponse.json({ error: 'Create a workflow draft before assessing readiness.' }, { status: 404 });
    const [unresolvedClarifications, replayAccuracy] = await Promise.all([countOpenClarifications(workflow.id), latestReplayAccuracy(projectId)]);
    const openContradictions = workflow.specification.contradictions.filter((item) => item.requiresClarification).length;
    return NextResponse.json({ workflowVersionId: workflow.id, ...recommendDeploymentMode({ reconstruction: workflow.specification, replayAccuracy, unresolvedClarifications, openContradictions }), metrics: { replayAccuracy, unresolvedClarifications, openContradictions } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params; const access = await authorizeProjectRequest(request, projectId, true);
    if (!access.actor) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 }); const workflow = await latestWorkflowVersion(projectId);
    if (!workflow) return NextResponse.json({ error: 'Create a workflow draft before assessing readiness.' }, { status: 404 });
    const [unresolvedClarifications, replayAccuracy] = await Promise.all([countOpenClarifications(workflow.id), latestReplayAccuracy(projectId)]); const openContradictions = workflow.specification.contradictions.filter((item) => item.requiresClarification).length;
    const readiness = recommendDeploymentMode({ reconstruction: workflow.specification, replayAccuracy, unresolvedClarifications, openContradictions });
    await saveReadiness({ projectId, workflowVersionId: workflow.id, recommendedMode: readiness.mode, reasons: readiness.reasons, metrics: { replayAccuracy, unresolvedClarifications, openContradictions }, actorId: access.actor.id });
    return NextResponse.json(readiness, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
