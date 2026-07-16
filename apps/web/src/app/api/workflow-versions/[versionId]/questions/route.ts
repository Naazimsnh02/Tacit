import { NextResponse } from 'next/server';
import { ClarificationInputError, generateClarificationQuestions } from '../../../../../lib/clarification/service';
import { SupabaseClarificationRepository } from '../../../../../lib/clarification/supabase-repository';
import { authorizeProjectRequest, errorResponse, serviceRequest } from '../../../../../lib/platform/api';

export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await context.params;
    const rows = await serviceRequest<Array<{ project_id: string }>>(`workflow_versions?id=eq.${encodeURIComponent(versionId)}&select=project_id&limit=1`);
    if (rows[0]) await authorizeProjectRequest(request, rows[0].project_id);
    return NextResponse.json(await generateClarificationQuestions({ workflowVersionId: versionId, repository: new SupabaseClarificationRepository() }));
  } catch (error) { if (error instanceof ClarificationInputError) return NextResponse.json({ error: error.message }, { status: 404 }); return errorResponse(error); }
}
