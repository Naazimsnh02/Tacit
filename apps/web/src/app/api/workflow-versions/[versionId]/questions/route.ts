import { NextResponse } from 'next/server';
import { ClarificationInputError, generateClarificationQuestions } from '../../../../../lib/clarification/service';
import { SupabaseClarificationRepository } from '../../../../../lib/clarification/supabase-repository';

export async function GET(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  try { const { versionId } = await context.params; return NextResponse.json(await generateClarificationQuestions({ workflowVersionId: versionId, repository: new SupabaseClarificationRepository() })); }
  catch (error) { return NextResponse.json({ error: error instanceof ClarificationInputError ? error.message : 'Unable to load clarification questions.' }, { status: error instanceof ClarificationInputError ? 404 : 500 }); }
}
