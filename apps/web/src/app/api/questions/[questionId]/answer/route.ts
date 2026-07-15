import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ClarificationInputError, answerClarificationQuestion } from '../../../../../lib/clarification/service';
import { SupabaseClarificationRepository } from '../../../../../lib/clarification/supabase-repository';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';

const requestSchema = z.object({ answer: z.unknown() });
export async function POST(request: Request, context: { params: Promise<{ questionId: string }> }) {
  try { const [{ questionId }, body] = await Promise.all([context.params, request.json()]); return NextResponse.json(await answerClarificationQuestion({ questionId, answer: requestSchema.parse(body).answer, repository: new SupabaseClarificationRepository(), registry: createWorkflowRegistry() }), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof ClarificationInputError || error instanceof z.ZodError ? error.message : 'Unable to apply clarification answer.' }, { status: error instanceof ClarificationInputError || error instanceof z.ZodError ? 400 : 500 }); }
}
