import { NextResponse } from 'next/server';
import { getProposal, markBuildsStale, nextWorkflowVersion, resolveProposal, saveWorkflowVersion, workflowVersion } from '../../../../../lib/ai-first/repository';
import { applyWorkflowPatch } from '../../../../../lib/ai-first/service';
import { authorizeProjectRequest, errorResponse } from '../../../../../lib/platform/api';

export async function POST(request: Request, context: { params: Promise<{ proposalId: string }> }) {
  try {
    const { proposalId } = await context.params; const proposal = await getProposal(proposalId); if (!proposal) return NextResponse.json({ error: 'Change proposal not found.' }, { status: 404 });
    const access = await authorizeProjectRequest(request, proposal.projectId, true); if (!access.actor) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 }); if (proposal.status !== 'pending') return NextResponse.json({ error: 'This change proposal has already been decided.' }, { status: 409 });
    const previous = await workflowVersion(proposal.workflowVersionId); if (!previous) return NextResponse.json({ error: 'The proposal source workflow no longer exists.' }, { status: 409 });
    const specification = applyWorkflowPatch(previous.specification, proposal.patch); const version = await nextWorkflowVersion(proposal.projectId);
    const resulting = await saveWorkflowVersion({ projectId: proposal.projectId, version, specification, actorId: access.actor.id }); await markBuildsStale(previous.id); await resolveProposal(proposal.id, 'accepted', resulting.id);
    return NextResponse.json({ workflowVersionId: resulting.id, version: resulting.version }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
