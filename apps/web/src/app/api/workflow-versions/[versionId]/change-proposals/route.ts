import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createProposal, workflowVersion } from '../../../../../lib/ai-first/repository';
import { applyWorkflowPatch, draftWorkflowChange } from '../../../../../lib/ai-first/service';
import { authorizeProjectRequest, enforceRateLimit, errorResponse } from '../../../../../lib/platform/api';

const requestSchema = z.object({ requestedChange: z.string().trim().min(3).max(4_000), patch: z.array(z.object({ op: z.enum(['add', 'replace', 'remove']), path: z.string().min(1), value: z.unknown().optional() })).min(1).optional(), affectedRuleIds: z.array(z.string().min(1)).optional(), riskLevel: z.enum(['low', 'medium', 'high']).optional() });
export async function POST(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await context.params; const version = await workflowVersion(versionId); if (!version) return NextResponse.json({ error: 'Workflow version not found.' }, { status: 404 });
    const access = await authorizeProjectRequest(request, version.projectId, true); if (!access.actor) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 }); enforceRateLimit(access.actor.id, 'change-proposal:create', 20);
    const body = requestSchema.parse(await request.json()); const generated = body.patch ? null : await draftWorkflowChange({ requestedChange: body.requestedChange, reconstruction: version.specification }); const patch = body.patch ?? generated?.patch ?? []; const preview = applyWorkflowPatch(version.specification, patch);
    const beforeRules = new Set(version.specification.rules.map((rule) => rule.id)); const afterRules = new Set(preview.rules.map((rule) => rule.id));
    const proposal = await createProposal({ projectId: version.projectId, workflowVersionId: versionId, requestedChange: body.requestedChange, patch, affectedRuleIds: body.affectedRuleIds ?? generated?.affectedRuleIds ?? [], riskLevel: body.riskLevel ?? generated?.riskLevel ?? 'medium', actorId: access.actor.id, impact: { explanation: generated?.explanation ?? 'Structured change supplied by the user.', rulesAdded: [...afterRules].filter((id) => !beforeRules.has(id)), rulesRemoved: [...beforeRules].filter((id) => !afterRules.has(id)), replayRequired: true, confirmationRequired: true } });
    return NextResponse.json({ proposal, preview }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
