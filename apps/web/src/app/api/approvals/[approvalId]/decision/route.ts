import { z } from 'zod';
import { ApprovalInputError, recordApprovalDecision } from '../../../../../lib/approvals/service';
import { SupabaseApprovalRepository } from '../../../../../lib/approvals/supabase-repository';

export async function POST(request: Request, context: { params: Promise<{ approvalId: string }> }) {
  try {
    const [{ approvalId }, body] = await Promise.all([context.params, request.json()]);
    z.string().uuid().parse(approvalId);
    return Response.json(await recordApprovalDecision(new SupabaseApprovalRepository(), approvalId, body), { status: 201 });
  } catch (error) {
    const recoverable = error instanceof z.ZodError || error instanceof ApprovalInputError;
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to record approval action.', recoverable }, { status: recoverable ? 400 : 500 });
  }
}
