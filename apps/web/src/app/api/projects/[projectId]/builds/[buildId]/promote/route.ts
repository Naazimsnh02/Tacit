import { z } from 'zod';
import { authenticateRequest, canWrite, enforceRateLimit, errorResponse, organizationRoleFor, serviceRequest, ApiError } from '../../../../../../../lib/platform/api';

const ids = z.object({ projectId: z.string().uuid(), buildId: z.string().uuid() });

/** Promotion is an auditable human decision; a passed build is not executable until this route is called. */
export async function POST(request: Request, context: { params: Promise<{ projectId: string; buildId: string }> }) {
  try {
    const [params, actor] = await Promise.all([context.params, authenticateRequest(request)]);
    const { projectId, buildId } = ids.parse(params);
    enforceRateLimit(actor.id, 'agent-build:promote', 10);
    const rows = await serviceRequest<Array<{ status: string; promotion_status: string; projects: { organization_id: string } }>>(`agent_builds?id=eq.${encodeURIComponent(buildId)}&project_id=eq.${encodeURIComponent(projectId)}&select=status,promotion_status,projects!inner(organization_id)&limit=1`);
    const row = rows[0]; const build = row ? { status: row.status, promotion_status: row.promotion_status, organization_id: row.projects.organization_id } : null;
    if (!build) throw new ApiError(404, 'Build not found.');
    if (!canWrite(await organizationRoleFor(actor.id, build.organization_id))) throw new ApiError(403, 'You do not have permission to promote this build.');
    if (build.status !== 'succeeded' || build.promotion_status !== 'pending') throw new ApiError(409, 'Only a passed build awaiting review can be promoted.');
    await serviceRequest(`agent_builds?id=eq.${encodeURIComponent(buildId)}`, { method: 'PATCH', body: JSON.stringify({ promotion_status: 'promoted', promoted_by: actor.id, promoted_at: new Date().toISOString() }) });
    await serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: build.organization_id, project_id: projectId, actor_id: actor.id, event_type: 'agent_build.promoted', payload: { buildId } }]) });
    return Response.json({ buildId, promotionStatus: 'promoted' });
  } catch (error) { return errorResponse(error); }
}
