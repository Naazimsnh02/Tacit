import { z } from 'zod';
import { RuntimeAgentExecutor } from '../../../../../../lib/evaluations/runtime-executor';
import { SupervisedCaseInputError, executeSupervisedCase } from '../../../../../../lib/evaluations/supervised-case';
import { SupabaseSupervisedCaseRepository } from '../../../../../../lib/evaluations/supabase-repository';
import { createWorkflowRegistry } from '../../../../../../lib/workflow-packs';
import { ApiError, authorizeProjectRequest, enforceRateLimit, errorResponse, serviceRequest } from '../../../../../../lib/platform/api';

const requestSchema = z.object({ testCaseId: z.string().uuid(), buildId: z.string().uuid().optional() });

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, body] = await Promise.all([context.params, request.json()]);
    const access = await authorizeProjectRequest(request, projectId, true);
    if (access.mode !== 'production' || !access.actor) throw new ApiError(403, 'Supervised case execution is available only for production projects.');
    enforceRateLimit(access.actor.id, 'cases:supervised_execute', 20);
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey || idempotencyKey.length < 8) throw new ApiError(400, 'An Idempotency-Key header is required.');
    const existing = await serviceRequest<Array<{ response_status: number; response_body: unknown }>>(`idempotency_keys?actor_id=eq.${encodeURIComponent(access.actor.id)}&endpoint=eq.cases.supervised_execute&key=eq.${encodeURIComponent(idempotencyKey)}&select=response_status,response_body&limit=1`);
    if (existing[0]) return Response.json(existing[0].response_body, { status: existing[0].response_status });
    const payload = requestSchema.parse(body);
    const result = await executeSupervisedCase({ projectId, ...payload, actorId: access.actor.id, registry: createWorkflowRegistry(), repository: new SupabaseSupervisedCaseRepository(), executor: new RuntimeAgentExecutor() });
    const responseBody = { outcome: result.outcome, approval: result.approval };
    await Promise.all([
      serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{
        organization_id: access.organizationId, project_id: projectId, actor_id: access.actor.id,
        event_type: result.approval ? 'case.supervised_approval_requested' : 'case.supervised_executed',
        payload: { testCaseId: payload.testCaseId, buildId: payload.buildId ?? null, approvalId: result.approval?.id ?? null },
      }]) }),
      serviceRequest('idempotency_keys', { method: 'POST', body: JSON.stringify([{
        actor_id: access.actor.id, organization_id: access.organizationId, endpoint: 'cases.supervised_execute', key: idempotencyKey,
        response_status: 201, response_body: responseBody,
      }]) }),
    ]);
    return Response.json(responseBody, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SupervisedCaseInputError) return Response.json({ error: error.message, recoverable: true }, { status: 400 });
    return errorResponse(error);
  }
}
