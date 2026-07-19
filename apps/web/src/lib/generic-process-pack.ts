import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { z } from 'zod';

/**
 * Domain-agnostic case contract used for knowledge-transfer projects.
 * Historical import, replay, and supervised execution accept any JSON object
 * payload; agents are expected to return at least decision + reason.
 */
export const genericCaseInputSchema = z.record(z.unknown()).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Case input must be a non-empty JSON object.' },
);

export const genericCaseOutcomeSchema = z
  .object({
    decision: z.string().min(1),
    reason: z.string().min(1),
  })
  .passthrough();

const createdAt = '2026-07-19T00:00:00.000Z';

const humanReviewDecisions = new Set([
  'manager_approval',
  'human_review',
  'hold',
  'escalate',
  'escalate_to_procurement',
  'request_more_information',
  'reject_or_escalate',
  'policy_clarification',
  'trust_and_safety',
  'quality_manager_approval',
  'decline_or_return_portal',
]);

/**
 * Default pack for process-agnostic KT projects. Registry falls back here when
 * a project still has a legacy workflow_type string.
 */
export const genericProcessWorkflowPack = defineWorkflowPack({
  id: 'generic_process',
  name: 'Generic process',
  version: '1.0.0',
  inputSchema: genericCaseInputSchema,
  outcomeSchema: genericCaseOutcomeSchema,
  runtimeSchema: {
    inputs: [
      {
        name: 'case',
        type: 'object',
        required: true,
        description:
          'evaluate(payload) receives the full labelled case as a flat JSON object. Use whatever keys the knowledge-transfer package and historical cases provide (ticket, amounts, flags, etc.). Do not require a fixed domain schema.',
      },
    ],
    outputs: [
      { name: 'decision', type: 'string', required: true, description: 'Primary disposition or routing decision code.' },
      { name: 'reason', type: 'string', required: true, description: 'Evidence-backed rationale for the decision.' },
    ],
  },
  workspaceDefinition: {
    panels: [
      { id: 'case', label: 'Case', kind: 'document', fields: [{ id: 'summary', label: 'Summary' }] },
      { id: 'policy', label: 'Policy', kind: 'reference', fields: [] },
    ],
    actions: [
      { id: 'review_case', label: 'Review case', eventAction: 'review_case', evidenceTypes: ['case_record'] },
      { id: 'record_decision', label: 'Record decision', eventAction: 'record_decision', evidenceTypes: ['case_record'] },
    ],
    outcomes: [
      { id: 'auto_path', label: 'Auto-path' },
      { id: 'manager_approval', label: 'Manager approval' },
      { id: 'hold', label: 'Hold' },
      { id: 'escalate', label: 'Escalate' },
    ],
  },
  eventCatalog: ['review_case', 'record_decision'],
  evidenceTypes: ['case_record', 'policy', 'walkthrough'],
  supportedEvidenceArtifactTypes: ['sop', 'document', 'spreadsheet', 'image', 'audio', 'video'],
  supportedActions: [
    { id: 'review_case', label: 'Review case', eventAction: 'review_case', evidenceTypes: ['case_record'] },
    { id: 'record_decision', label: 'Record decision', eventAction: 'record_decision', evidenceTypes: ['case_record'] },
  ],
  approvalPolicy: { type: 'human_review_when_flagged' },
  evaluationDefinition: { fixtureSet: 'generic-process' },
  promptContext:
    'Reconstruct a domain-agnostic operational workflow from the knowledge-transfer package. Prefer process steps, policy rules, thresholds, and never-automate boundaries. Do not invent connectors or domain-specific systems that are not supported by the evidence.',
  approvalRequestForOutcome: ({ outcome }) => {
    const decision = String(outcome.decision ?? '').trim().toLowerCase();
    const reason = String(outcome.reason ?? 'Human review is required for this outcome.');
    if (!decision) return null;
    const needsApproval =
      humanReviewDecisions.has(decision)
      || decision.includes('approval')
      || decision.includes('escalate')
      || decision.includes('hold')
      || decision.includes('review');
    if (!needsApproval) return null;
    return {
      reason,
      riskLevel: decision.includes('fraud') || decision.includes('trust') ? 'high' : 'medium',
      requestedAction: decision,
      agentRecommendation: reason,
      confidence: typeof outcome.confidence === 'number' ? outcome.confidence : null,
      appliedRuleIds: Array.isArray(outcome.appliedRuleIds) ? outcome.appliedRuleIds.map(String) : [],
    };
  },
  seedLoader: () => ({
    project: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationId: '00000000-0000-4000-8000-000000000001',
      mode: 'demo',
      createdBy: null,
      name: 'Generic process sample',
      workflowType: 'generic_process',
      status: 'draft',
      configuration: {},
      createdAt,
      updatedAt: createdAt,
    },
    documents: [],
    testCases: [],
    domainRecords: [],
    approvalRequests: [],
    impactSnapshots: [],
  }),
});
