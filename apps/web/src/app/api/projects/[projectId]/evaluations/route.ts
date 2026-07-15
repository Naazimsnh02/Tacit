import { z } from 'zod';
import { replayHistoricalCases, EvaluationInputError } from '../../../../../lib/evaluations/service';
import { SupabaseEvaluationRepository } from '../../../../../lib/evaluations/supabase-repository';
import { RuntimeAgentExecutor } from '../../../../../lib/evaluations/runtime-executor';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';

const requestSchema = z.object({ buildId: z.string().uuid().optional() }).default({});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, body] = await Promise.all([context.params, request.json().catch(() => ({}))]);
    const payload = requestSchema.parse(body);
    const result = await replayHistoricalCases({ projectId, buildId: payload.buildId, registry: createWorkflowRegistry(), repository: new SupabaseEvaluationRepository(), executor: new RuntimeAgentExecutor() });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to replay historical cases.';
    return Response.json({ error: message, recoverable: error instanceof z.ZodError || error instanceof EvaluationInputError }, { status: error instanceof z.ZodError || error instanceof EvaluationInputError ? 400 : 500 });
  }
}
