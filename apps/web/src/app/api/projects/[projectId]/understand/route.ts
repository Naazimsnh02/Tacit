import { NextResponse } from 'next/server';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';
import { createConfiguredReconstructionModel } from '../../../../../lib/reconstruction/openai-model';
import { ReconstructionInputError, ReconstructionOutputError, reconstructWorkflow } from '../../../../../lib/reconstruction/service';
import { SupabaseReconstructionRepository } from '../../../../../lib/reconstruction/supabase-repository';
import { persistCompletedObservation } from '../../../../../lib/observation/service';
import { SupabaseObservationRepository } from '../../../../../lib/observation/supabase-repository';
import { AutomatedUnderstandingInputError, createAutomatedUnderstandingObservation } from '../../../../../lib/understanding/service';
import { authorizeProjectRequest, enforceRateLimit, errorResponse } from '../../../../../lib/platform/api';

/**
 * Automatic first pass over every ready source in a production project. The
 * persisted system observation preserves the same evidence trail and guards
 * used by the advanced, manual observation route.
 */
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const access = await authorizeProjectRequest(request, projectId, true);
    if (access.mode !== 'production' || !access.actor) return NextResponse.json({ error: 'Automatic understanding is available only for production projects.' }, { status: 400 });
    enforceRateLimit(access.actor.id, 'understand:create', 10);
    const repository = new SupabaseReconstructionRepository();
    const [evidence, insights] = await Promise.all([repository.getEvidence(projectId), repository.getEvidenceInsights(projectId)]);
    if (!insights.length) throw new AutomatedUnderstandingInputError('Finish source intelligence before preparing a workflow so every inference has interpreted, cited evidence.');
    // Prefer a completed package synthesis draft when present; fall back to any
    // cited insights so older packages and partial runs still reconstruct.
    const observation = createAutomatedUnderstandingObservation({ projectId, evidence, insights });
    await persistCompletedObservation({ projectId, ...observation, repository: new SupabaseObservationRepository() });
    const result = await reconstructWorkflow({
      projectId,
      sessionId: observation.session.id,
      finalDecision: 'Initial workflow draft requested from all available source material, using process-aware package synthesis when available.',
      registry: createWorkflowRegistry(),
      repository,
      model: createConfiguredReconstructionModel(),
    });
    return NextResponse.json({
      ...result,
      sessionId: observation.session.id,
      sourceCount: new Set(evidence.map((item) => item.artifactId)).size,
      packageSynthesis: insights.some((insight) => insight.kind.startsWith('package_')),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AutomatedUnderstandingInputError || error instanceof ReconstructionInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ReconstructionOutputError) return NextResponse.json({ error: error.message }, { status: 422 });
    return errorResponse(error);
  }
}
