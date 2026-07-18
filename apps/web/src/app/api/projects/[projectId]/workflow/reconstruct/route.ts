import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createConfiguredReconstructionModel } from '../../../../../../lib/reconstruction/openai-model';
import { ReconstructionInputError, ReconstructionOutputError, reconstructWorkflow } from '../../../../../../lib/reconstruction/service';
import { SupabaseReconstructionRepository } from '../../../../../../lib/reconstruction/supabase-repository';
import { createWorkflowRegistry } from '../../../../../../lib/workflow-packs';
import { authenticateRequest, canWrite, errorResponse, organizationRoleFor, serviceRequest, ApiError } from '../../../../../../lib/platform/api';

const requestSchema = z.object({ sessionId: z.string().uuid(), finalDecision: z.string().min(1).nullable().optional() });

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, body] = await Promise.all([context.params, request.json()]);
    const input = requestSchema.parse(body);
    const projects = await serviceRequest<Array<{ organization_id: string; mode: string }>>(`projects?id=eq.${encodeURIComponent(projectId)}&select=organization_id,mode&limit=1`);
    const project = projects[0]; if (!project) throw new ApiError(404, 'Project not found.');
    if (project.mode === 'production') {
      const actor = await authenticateRequest(request);
      if (!canWrite(await organizationRoleFor(actor.id, project.organization_id))) throw new ApiError(403, 'You do not have permission to reconstruct this workflow.');
    }
    const result = await reconstructWorkflow({ projectId, sessionId: input.sessionId, finalDecision: input.finalDecision ?? null, registry: createWorkflowRegistry(), repository: new SupabaseReconstructionRepository(), model: createConfiguredReconstructionModel() });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof ReconstructionInputError) return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid reconstruction request.' }, { status: 400 });
    if (error instanceof ReconstructionOutputError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof ApiError) return errorResponse(error);
    return NextResponse.json({ error: 'Unable to reconstruct the workflow. Try again.' }, { status: 500 });
  }
}
