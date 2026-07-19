import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  workflowReconstructionSchema,
  type ClarificationQuestion,
  type ExtractedEvidence,
  type WorkflowClaim,
  type WorkflowClaimEvidenceState,
  type WorkflowReconstruction,
} from '@tacit/core-schemas';

export const sourceInterpretationSchema = z.object({
  sourceClass: z.enum(['policy', 'record', 'spreadsheet', 'screen', 'conversation', 'recording', 'other']),
  summary: z.string().min(1).max(4_000),
  entities: z.array(z.object({ type: z.string().min(1), value: z.string().min(1), extractionIds: z.array(z.string().uuid()).min(1), confidence: z.number().min(0).max(1) })),
  facts: z.array(z.object({ statement: z.string().min(1), extractionIds: z.array(z.string().uuid()).min(1), confidence: z.number().min(0).max(1) })),
});
export type SourceInterpretation = z.infer<typeof sourceInterpretationSchema>;

export type PlannedTestCase = { readonly label: string; readonly category: 'historical' | 'contradiction' | 'boundary' | 'missing_evidence' | 'workflow_pack'; readonly ruleIds: readonly string[]; readonly evidenceIds: readonly string[]; readonly expected: string; };
export type DeploymentMode = 'observe_only' | 'recommend' | 'execute_with_approval' | 'low_risk_automatic';
export const workflowChangeDraftSchema = z.object({ patch: z.array(z.object({ op: z.enum(['add', 'replace', 'remove']), path: z.string().min(1), value: z.unknown().nullable() })).min(1), affectedRuleIds: z.array(z.string().min(1)), riskLevel: z.enum(['low', 'medium', 'high']), explanation: z.string().min(1) });
export type WorkflowChangeDraft = z.infer<typeof workflowChangeDraftSchema>;

/** Rejects model citations that are not durable project extractions. */
export function validateSourceInterpretation(value: unknown, evidence: readonly ExtractedEvidence[]): SourceInterpretation {
  const interpretation = sourceInterpretationSchema.parse(value);
  const ids = new Set(evidence.map((item) => item.id));
  for (const citation of [...interpretation.entities, ...interpretation.facts]) {
    if (citation.extractionIds.some((id) => !ids.has(id))) throw new AiFirstInputError('Source interpretation cited evidence outside this project.');
  }
  return interpretation;
}

export function createWorkflowClaims(input: { workflowVersionId: string; reconstruction: WorkflowReconstruction; evidenceIds: ReadonlySet<string>; now?: Date; createId?: () => string }): WorkflowClaim[] {
  const now = (input.now ?? new Date()).toISOString(); const createId = input.createId ?? randomUUID;
  const claim = (claimType: WorkflowClaim['claimType'], claimKey: string, statement: string, confidence: number | null, ids: readonly string[], state: WorkflowClaimEvidenceState): WorkflowClaim => ({
    id: createId(), workflowVersionId: input.workflowVersionId, claimType, claimKey, statement, confidence,
    extractionIds: ids.filter((id) => input.evidenceIds.has(id)), evidenceState: state, createdAt: now,
  });
  const claims = input.reconstruction.steps.map((step) => claim('step', step.id, step.description, step.confidence, step.evidenceIds, evidenceState(step.confidence, step.evidenceIds.length, false, false)));
  for (const rule of input.reconstruction.rules) claims.push(claim('rule', rule.id, `${rule.condition} → ${rule.action}`, rule.confidence, rule.evidenceIds, evidenceState(rule.confidence, rule.evidenceIds.length, rule.verificationStatus === 'confirmed', rule.verificationStatus === 'unverified')));
  for (const unknown of input.reconstruction.unknowns) claims.push(claim('assumption', unknown, unknown, null, [], 'missing_evidence'));
  for (const contradiction of input.reconstruction.contradictions) claims.push(claim('decision', contradiction.id, contradiction.description, null, contradiction.evidenceIds, 'contradictory'));
  return claims;
}

export function rankClarifications(questions: readonly ClarificationQuestion[]): ClarificationQuestion[] {
  return [...questions].sort((left, right) => priority(right) - priority(left) || left.createdAt.localeCompare(right.createdAt));
}

export function planSourceDerivedTests(reconstruction: WorkflowReconstruction, historicalCount = 0): PlannedTestCase[] {
  const tests: PlannedTestCase[] = [];
  if (historicalCount) tests.push({ label: `Replay ${historicalCount} labelled historical case${historicalCount === 1 ? '' : 's'}`, category: 'historical', ruleIds: reconstruction.rules.map((rule) => rule.id), evidenceIds: [], expected: 'Compare the agent outcome with the labelled outcome and retain the disagreement explanation.' });
  for (const rule of reconstruction.rules) {
    tests.push({ label: `Boundary: ${rule.name}`, category: 'boundary', ruleIds: [rule.id], evidenceIds: rule.evidenceIds, expected: `Exercise ${rule.condition}, its nearest safe boundary, and every declared exception.` });
    if (rule.verificationStatus !== 'confirmed') tests.push({ label: `Missing evidence: ${rule.name}`, category: 'missing_evidence', ruleIds: [rule.id], evidenceIds: rule.evidenceIds, expected: 'The agent must stop for clarification or human review, never infer an unconfirmed outcome.' });
  }
  for (const contradiction of reconstruction.contradictions) tests.push({ label: `Contradiction: ${contradiction.description}`, category: 'contradiction', ruleIds: reconstruction.rules.filter((rule) => contradiction.evidenceIds.some((id) => rule.evidenceIds.includes(id))).map((rule) => rule.id), evidenceIds: contradiction.evidenceIds, expected: 'The agent must escalate the conflict and preserve both cited sources.' });
  return tests;
}

export function recommendDeploymentMode(input: { reconstruction: WorkflowReconstruction; replayAccuracy: number | null; unresolvedClarifications: number; openContradictions: number }): { mode: DeploymentMode; reasons: string[] } {
  const unsafeRules = input.reconstruction.rules.filter((rule) => rule.riskLevel === 'high' || rule.verificationStatus !== 'confirmed').length;
  const reasons: string[] = [];
  if (input.unresolvedClarifications || input.openContradictions) reasons.push('Open expert questions or contradictions remain.');
  if (input.replayAccuracy === null) reasons.push('No labelled replay result is available yet.');
  if (unsafeRules) reasons.push(`${unsafeRules} rule${unsafeRules === 1 ? '' : 's'} still require supervised handling.`);
  if (input.unresolvedClarifications || input.openContradictions || input.replayAccuracy === null) return { mode: 'observe_only', reasons };
  if (input.replayAccuracy < 0.8) return { mode: 'recommend', reasons: [...reasons, 'Replay accuracy is below the supervised promotion threshold.'] };
  if (unsafeRules || input.replayAccuracy < 0.95) return { mode: 'execute_with_approval', reasons: [...reasons, 'Human approval remains required for consequential decisions.'] };
  return { mode: 'low_risk_automatic', reasons: ['All rules are confirmed, replay performance is strong, and workflow-pack policy still limits side effects.'] };
}

/** Applies a narrowly scoped proposal only after the caller has received an explicit acceptance. */
export function applyWorkflowPatch(reconstruction: WorkflowReconstruction, patch: readonly { readonly op: 'add' | 'replace' | 'remove'; readonly path: string; readonly value?: unknown }[]): WorkflowReconstruction {
  const draft = structuredClone(reconstruction) as Record<string, unknown>;
  for (const operation of patch) {
    const tokens = operation.path.split('/').slice(1).map(unescapeToken);
    if (!tokens.length || !['workflowObjective', 'inputs', 'steps', 'decisionPoints', 'rules', 'exceptions', 'contradictions', 'unknowns', 'approvalRequirements', 'automationCandidates'].includes(tokens[0] ?? '')) throw new AiFirstInputError('This proposal changes a field outside the workflow contract.');
    let target: Record<string, unknown> | unknown[] = draft;
    for (const token of tokens.slice(0, -1)) { const value = Array.isArray(target) ? target[Number(token)] : target[token]; if (!value || typeof value !== 'object') throw new AiFirstInputError('This proposal cannot be applied to the current workflow version.'); target = value as Record<string, unknown> | unknown[]; }
    const key = tokens.at(-1); if (!key) throw new AiFirstInputError('This proposal has an invalid patch path.');
    if (Array.isArray(target)) { const index = key === '-' ? target.length : Number(key); if (!Number.isInteger(index) || index < 0 || index > target.length) throw new AiFirstInputError('This proposal has an invalid array path.'); if (operation.op === 'remove') target.splice(index, 1); else if (operation.op === 'add') target.splice(index, 0, operation.value); else target[index] = operation.value; }
    else if (operation.op === 'remove') delete target[key]; else target[key] = operation.value;
  }
  return workflowReconstructionSchema.parse(draft);
}

/** The conversation model sees only confirmed workflow IR, never raw source files. */
export async function draftWorkflowChange(input: { requestedChange: string; reconstruction: WorkflowReconstruction }): Promise<WorkflowChangeDraft> {
  const prompt = `You are proposing a versioned edit to a typed workflow. Return JSON with patch, affectedRuleIds, riskLevel, and explanation. Use only JSON Patch paths rooted in /workflowObjective, /inputs, /steps, /decisionPoints, /rules, /exceptions, /contradictions, /unknowns, /approvalRequirements, or /automationCandidates. Never remove evidenceIds from a step or rule. Request: ${input.requestedChange}\n\nWorkflow IR:\n${JSON.stringify(input.reconstruction)}`;
  const apiKey = process.env.OPENAI_API_KEY; const model = process.env.OPENAI_REASONING_MODEL;
  if (!apiKey || !model) throw new AiFirstInputError('Workflow conversation is not configured. Supply a structured patch or configure the reasoning model.');
  const schema = {
    type: 'object', additionalProperties: false, required: ['patch', 'affectedRuleIds', 'riskLevel', 'explanation'],
    properties: {
      patch: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['op', 'path', 'value'], properties: { op: { type: 'string', enum: ['add', 'replace', 'remove'] }, path: { type: 'string' }, value: {} } } },
      affectedRuleIds: { type: 'array', items: { type: 'string' } }, riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] }, explanation: { type: 'string' },
    },
  } as const;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, store: false, input: prompt, text: { format: { type: 'json_schema', name: 'tacit_workflow_change', strict: true, schema } } }),
  });
  if (!response.ok) throw new AiFirstInputError('Tacit could not prepare a workflow change proposal.'); const payload = await response.json() as { output_text?: string }; if (!payload.output_text) throw new AiFirstInputError('Tacit returned no workflow change proposal.'); return workflowChangeDraftSchema.parse(JSON.parse(payload.output_text));
}

export class AiFirstInputError extends Error {}

function evidenceState(confidence: number, citations: number, confirmed: boolean, unverified: boolean): WorkflowClaimEvidenceState {
  if (!citations) return 'missing_evidence'; if (confirmed) return 'confirmed'; if (unverified) return 'requires_expert_confirmation'; return confidence >= 0.8 ? 'strongly_inferred' : 'weakly_inferred';
}
function priority(question: ClarificationQuestion): number { return (question.riskIfUnanswered.toLowerCase().includes('unsafe') ? 100 : 0) + (question.relatedRuleId ? 20 : 0) + question.evidenceIds.length; }
function unescapeToken(value: string): string { return value.replace(/~1/g, '/').replace(/~0/g, '~'); }
