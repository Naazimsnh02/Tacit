import { z } from 'zod';
import { authenticateRequest, canWrite, enforceRateLimit, errorResponse, organizationRoleFor, serviceRequest, ApiError } from '../../../../../../../lib/platform/api';
import { confirmWorkflow, WorkflowConfirmationError } from '../../../../../../../lib/workflow-confirmation/service';
import { SupabaseWorkflowConfirmationRepository } from '../../../../../../../lib/workflow-confirmation/supabase-repository';

const bodySchema = z.object({ rulesConfirmed: z.literal(true), contradictionsReviewed: z.literal(true), automationBoundariesConfirmed: z.literal(true), approvalPoliciesConfirmed: z.literal(true) });

export async function POST(request: Request, context: { params: Promise<{ projectId: string; versionId: string }> }) {
  try {
    const [{ projectId, versionId }, actor, body] = await Promise.all([context.params, authenticateRequest(request), request.json()]);
    z.string().uuid().parse(projectId); z.string().uuid().parse(versionId); enforceRateLimit(actor.id, 'workflow:confirm', 20);
    const projects = await serviceRequest<Array<{ organization_id: string; mode: string }>>(`projects?id=eq.${encodeURIComponent(projectId)}&mode=eq.production&select=organization_id,mode&limit=1`);
    const project = projects[0]; if (!project) throw new ApiError(404, 'Production project not found.');
    if (!canWrite(await organizationRoleFor(actor.id, project.organization_id))) throw new ApiError(403, 'You do not have permission to confirm this workflow.');
    const confirmation = await confirmWorkflow({ projectId, workflowVersionId: versionId, actorId: actor.id, confirmation: bodySchema.parse(body), repository: new SupabaseWorkflowConfirmationRepository() });
    await serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: project.organization_id, project_id: projectId, actor_id: actor.id, event_type: 'workflow.confirmed', payload: { workflowVersionId: versionId } }]) });
    return Response.json({ confirmation }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkflowConfirmationError) return Response.json({ error: error.message }, { status: 409 });
    return errorResponse(error);
  }
}
