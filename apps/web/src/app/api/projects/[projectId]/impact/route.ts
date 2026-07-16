import { z } from 'zod';
import { SupabaseApprovalRepository } from '../../../../../lib/approvals/supabase-repository';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params; z.string().uuid().parse(projectId);
    const snapshot = await new SupabaseApprovalRepository().latestImpact(projectId);
    if (!snapshot) return Response.json({ error: 'No stored impact snapshot exists for this project.' }, { status: 404 });
    return Response.json(snapshot);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unable to load impact metrics.' }, { status: 400 }); }
}
