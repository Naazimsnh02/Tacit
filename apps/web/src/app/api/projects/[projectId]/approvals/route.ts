import { z } from 'zod';
import { SupabaseApprovalRepository } from '../../../../../lib/approvals/supabase-repository';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try { const { projectId } = await context.params; z.string().uuid().parse(projectId); return Response.json(await new SupabaseApprovalRepository().list(projectId)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unable to load approval requests.' }, { status: 400 }); }
}
