import { z } from 'zod';
import { replayHistoricalCases, EvaluationInputError } from '../../../../../lib/evaluations/service';
import { SupabaseEvaluationRepository } from '../../../../../lib/evaluations/supabase-repository';
import { RuntimeAgentExecutor } from '../../../../../lib/evaluations/runtime-executor';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';
import { authorizeProjectRequest, enforceRateLimit, errorResponse } from '../../../../../lib/platform/api';

const requestSchema = z.object({ buildId: z.string().uuid().optional() }).default({});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, body] = await Promise.all([context.params, request.json().catch(() => ({}))]);
    const access = await authorizeProjectRequest(request, projectId, true);
    if (access.actor) enforceRateLimit(access.actor.id, 'evaluations:replay', 10);
    const payload = requestSchema.parse(body);
    const result = await replayHistoricalCases({ projectId, buildId: payload.buildId, registry: createWorkflowRegistry(), repository: new SupabaseEvaluationRepository(), executor: new RuntimeAgentExecutor() });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof EvaluationInputError) return Response.json({ error: error.message, recoverable: true }, { status: 400 });
    return errorResponse(error);
  }
}
