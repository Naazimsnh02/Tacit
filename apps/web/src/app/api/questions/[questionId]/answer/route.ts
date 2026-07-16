import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ClarificationInputError, answerClarificationQuestion } from '../../../../../lib/clarification/service';
import { SupabaseClarificationRepository } from '../../../../../lib/clarification/supabase-repository';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';
import { authorizeProjectRequest, errorResponse, serviceRequest, ApiError } from '../../../../../lib/platform/api';

const requestSchema = z.object({ answer: z.unknown() });
export async function POST(request: Request, context: { params: Promise<{ questionId: string }> }) {
  try {
    const [{ questionId }, body] = await Promise.all([context.params, request.json()]);
    const rows = await serviceRequest<Array<{ workflow_versions: { project_id: string } | null }>>(`clarification_questions?id=eq.${encodeURIComponent(questionId)}&select=workflow_versions!inner(project_id)&limit=1`);
    const projectId = rows[0]?.workflow_versions?.project_id; if (!projectId) throw new ApiError(404, 'Clarification question was not found.');
    await authorizeProjectRequest(request, projectId, true);
    return NextResponse.json(await answerClarificationQuestion({ questionId, answer: requestSchema.parse(body).answer, repository: new SupabaseClarificationRepository(), registry: createWorkflowRegistry() }), { status: 201 });
  } catch (error) { if (error instanceof ClarificationInputError || error instanceof z.ZodError) return NextResponse.json({ error: error.message }, { status: 400 }); return errorResponse(error); }
}
