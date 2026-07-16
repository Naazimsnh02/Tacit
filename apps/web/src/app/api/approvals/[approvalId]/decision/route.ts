import { z } from 'zod';
import { ApprovalInputError, recordApprovalDecision } from '../../../../../lib/approvals/service';
import { SupabaseApprovalRepository } from '../../../../../lib/approvals/supabase-repository';
import { authorizeProjectRequest, enforceRateLimit, errorResponse, serviceRequest, ApiError } from '../../../../../lib/platform/api';

export async function POST(request: Request, context: { params: Promise<{ approvalId: string }> }) {
  try {
    const [{ approvalId }, body] = await Promise.all([context.params, request.json()]);
    z.string().uuid().parse(approvalId);
    const rows = await serviceRequest<Array<{ project_id: string }>>(`approval_requests?id=eq.${encodeURIComponent(approvalId)}&select=project_id&limit=1`);
    const projectId = rows[0]?.project_id; if (!projectId) throw new ApiError(404, 'Approval request was not found.');
    const access = await authorizeProjectRequest(request, projectId, true);
    if (access.actor) enforceRateLimit(access.actor.id, 'approvals:decision', 30);
    const actor = access.actor ? { id: access.actor.id, displayName: access.actor.email ?? 'Authenticated reviewer' } : undefined;
    const action = await recordApprovalDecision(new SupabaseApprovalRepository(), approvalId, body, actor);
    if (access.actor) await serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: access.organizationId, project_id: projectId, actor_id: access.actor.id, event_type: 'approval.decided', payload: { approvalId, decision: action.decision } }]) });
    return Response.json(action, { status: 201 });
  } catch (error) {
    const recoverable = error instanceof z.ZodError || error instanceof ApprovalInputError;
    if (recoverable) return Response.json({ error: error.message, recoverable: true }, { status: 400 });
    return errorResponse(error);
  }
}
