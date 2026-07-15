import { NextResponse } from 'next/server';
import { createWorkflowGraph } from '../../../../../lib/workflow-graph/model';
import { SupabaseWorkflowGraphRepository } from '../../../../../lib/workflow-graph/repository';

export async function GET(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await context.params;
    const reconstruction = await new SupabaseWorkflowGraphRepository().getReconstruction(versionId);
    if (!reconstruction) return NextResponse.json({ error: 'Workflow version not found.' }, { status: 404 });
    return NextResponse.json(createWorkflowGraph(reconstruction));
  } catch {
    return NextResponse.json({ error: 'Unable to load the workflow graph.' }, { status: 500 });
  }
}
