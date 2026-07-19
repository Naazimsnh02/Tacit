import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeProjectRequest, errorResponse, serviceRequest } from '../../../../../lib/platform/api';

const requestSchema = z.object({ assigneeId: z.string().uuid().nullable().default(null), deferReason: z.string().trim().min(3).max(1_000).nullable().default(null), dueAt: z.string().datetime({ offset: true }).nullable().default(null), attachmentExtractionIds: z.array(z.string().uuid()).default([]) });
export async function POST(request: Request, context: { params: Promise<{ questionId: string }> }) {
  try {
    const { questionId } = await context.params; const rows = await serviceRequest<Array<{ workflow_versions: { project_id: string } | null }>>(`clarification_questions?id=eq.${encodeURIComponent(questionId)}&select=workflow_versions!inner(project_id)&limit=1`); const projectId = rows[0]?.workflow_versions?.project_id;
    if (!projectId) return NextResponse.json({ error: 'Clarification question not found.' }, { status: 404 }); await authorizeProjectRequest(request, projectId, true); const body = requestSchema.parse(await request.json());
    await serviceRequest('clarification_assignments', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ question_id: questionId, assignee_id: body.assigneeId, defer_reason: body.deferReason, due_at: body.dueAt, attachment_extraction_ids: body.attachmentExtractionIds, status: body.deferReason ? 'deferred' : 'open' }]) });
    return NextResponse.json({ status: body.deferReason ? 'deferred' : 'assigned' });
  } catch (error) { return errorResponse(error); }
}
