import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOpenAiReconstructionModel } from '../../../../../../lib/reconstruction/openai-model';
import { ReconstructionInputError, ReconstructionOutputError, reconstructWorkflow } from '../../../../../../lib/reconstruction/service';
import { SupabaseReconstructionRepository } from '../../../../../../lib/reconstruction/supabase-repository';
import { createWorkflowRegistry } from '../../../../../../lib/workflow-packs';

const requestSchema = z.object({ sessionId: z.string().uuid(), finalDecision: z.string().min(1).nullable().optional() });

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, body] = await Promise.all([context.params, request.json()]);
    const input = requestSchema.parse(body);
    const result = await reconstructWorkflow({ projectId, sessionId: input.sessionId, finalDecision: input.finalDecision ?? null, registry: createWorkflowRegistry(), repository: new SupabaseReconstructionRepository(), model: createOpenAiReconstructionModel() });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof ReconstructionInputError) return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid reconstruction request.' }, { status: 400 });
    if (error instanceof ReconstructionOutputError) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: 'Unable to reconstruct the workflow. Try again.' }, { status: 500 });
  }
}
