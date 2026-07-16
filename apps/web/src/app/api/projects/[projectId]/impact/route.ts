import { z } from 'zod';
import { SupabaseApprovalRepository } from '../../../../../lib/approvals/supabase-repository';
import { authorizeProjectRequest, enforceRateLimit, errorResponse } from '../../../../../lib/platform/api';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params; z.string().uuid().parse(projectId); const access = await authorizeProjectRequest(_request, projectId);
    if (access.actor) enforceRateLimit(access.actor.id, 'impact:read', 60);
    const snapshot = await new SupabaseApprovalRepository().latestImpact(projectId);
    if (!snapshot) return Response.json({ error: 'No stored impact snapshot exists for this project.' }, { status: 404 });
    return Response.json(snapshot);
  } catch (error) { return errorResponse(error); }
}
