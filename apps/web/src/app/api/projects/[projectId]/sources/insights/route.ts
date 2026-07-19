import { NextResponse } from 'next/server';
import { enqueueUnderstandingJobs, listSourceIntelligence, AiFirstRepositoryError } from '../../../../../../lib/ai-first/repository';
import { authorizeProjectRequest, enforceRateLimit, errorResponse } from '../../../../../../lib/platform/api';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try { const { projectId } = await context.params; await authorizeProjectRequest(request, projectId); return NextResponse.json(await listSourceIntelligence(projectId)); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params; const access = await authorizeProjectRequest(request, projectId, true);
    if (access.mode !== 'production' || !access.actor) return NextResponse.json({ error: 'Source intelligence is available only for production projects.' }, { status: 400 });
    enforceRateLimit(access.actor.id, 'source-intelligence:create', 10); const status = await enqueueUnderstandingJobs(projectId, access.actor.id);
    return NextResponse.json({ status }, { status: status === 'queued' ? 202 : 200 });
  } catch (error) { if (error instanceof AiFirstRepositoryError) return NextResponse.json({ error: error.message }, { status: 400 }); return errorResponse(error); }
}
