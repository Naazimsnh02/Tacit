import { z } from 'zod';
import { SupabaseApprovalRepository } from '../../../../../lib/approvals/supabase-repository';
import { authorizeProjectRequest, enforceRateLimit, errorResponse } from '../../../../../lib/platform/api';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try { const { projectId } = await context.params; z.string().uuid().parse(projectId); const access = await authorizeProjectRequest(_request, projectId); if (access.actor) enforceRateLimit(access.actor.id, 'approvals:list', 60); return Response.json(await new SupabaseApprovalRepository().list(projectId)); }
  catch (error) { return errorResponse(error); }
}
