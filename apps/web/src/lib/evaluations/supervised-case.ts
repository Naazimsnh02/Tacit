import { approvalRequestSchema, testCaseSchema, type ApprovalRequest, type TestCase } from '@tacit/core-schemas';
import type { WorkflowRegistry } from '@tacit/workflow-registry';
import type { AgentExecutor } from './service';

export interface SupervisedCaseRepository {
  getBuild(input: { projectId: string; buildId?: string }): Promise<{ id: string; workflowVersionId: string; workflowType: string } | null>;
  getTestCase(input: { projectId: string; testCaseId: string }): Promise<TestCase | null>;
  saveRequest(input: Omit<ApprovalRequest, 'id'>, requestedBy?: string): Promise<ApprovalRequest>;
}

export class SupervisedCaseInputError extends Error {}

/**
 * Executes one evidence-linked case without writing replay results.
 * Case I/O is process-agnostic JSON; optional pack helpers may still create
 * approval drafts for human-review dispositions.
 */
export async function executeSupervisedCase(input: {
  projectId: string; testCaseId: string; buildId?: string; actorId?: string; registry: WorkflowRegistry;
  repository: SupervisedCaseRepository; executor: AgentExecutor;
}): Promise<{ outcome: Record<string, unknown>; approval: ApprovalRequest | null }> {
  const [build, rawCase] = await Promise.all([
    input.repository.getBuild({ projectId: input.projectId, buildId: input.buildId }),
    input.repository.getTestCase({ projectId: input.projectId, testCaseId: input.testCaseId }),
  ]);
  if (!build) throw new SupervisedCaseInputError('A promoted generated build is required before a supervised case can run.');
  if (!rawCase) throw new SupervisedCaseInputError('The selected supervised case was not found.');

  const testCase = testCaseSchema.parse(rawCase);
  if (!testCase.input || typeof testCase.input !== 'object' || Array.isArray(testCase.input) || Object.keys(testCase.input).length === 0) {
    throw new SupervisedCaseInputError('The selected case input must be a non-empty JSON object.');
  }
  const caseInput = testCase.input as Record<string, unknown>;
  const pack = input.registry.get(build.workflowType);
  const execution = await input.executor.execute(build.id, caseInput);
  if (execution.error || !execution.outcome) throw new SupervisedCaseInputError(execution.error ?? 'The generated agent did not return an outcome.');
  if (typeof execution.outcome !== 'object' || Array.isArray(execution.outcome)) {
    throw new SupervisedCaseInputError('The generated agent returned an invalid workflow outcome.');
  }
  const outcome = execution.outcome;

  const approvalDraft = pack.approvalRequestForOutcome?.({
    caseInput,
    outcome,
    evidenceIds: testCase.evidenceIds,
  }) ?? genericApprovalDraft(outcome);
  if (!approvalDraft) return { outcome, approval: null };
  if (testCase.evidenceIds.length === 0) throw new SupervisedCaseInputError('A supervised case that requires approval must include evidence references.');
  const approval = await input.repository.saveRequest(approvalRequestSchema.omit({ id: true }).parse({
    projectId: input.projectId, workflowVersionId: build.workflowVersionId, status: 'pending',
    reason: approvalDraft.reason, riskLevel: approvalDraft.riskLevel, requestedAction: approvalDraft.requestedAction,
    agentRecommendation: approvalDraft.agentRecommendation, confidence: approvalDraft.confidence,
    appliedRuleIds: approvalDraft.appliedRuleIds, agentBuildId: build.id, evidenceIds: testCase.evidenceIds,
    payload: { caseId: testCase.id, caseLabel: testCase.label, input: caseInput, outcome },
    createdAt: new Date().toISOString(),
  }), input.actorId);
  return { outcome, approval };
}

function genericApprovalDraft(outcome: Record<string, unknown>) {
  const decision = String(outcome.decision ?? '').trim().toLowerCase();
  const reason = String(outcome.reason ?? 'Human review is required for this outcome.');
  if (!decision) return null;
  const needsApproval =
    decision.includes('approval')
    || decision.includes('escalate')
    || decision.includes('hold')
    || decision.includes('review')
    || decision.includes('trust');
  if (!needsApproval) return null;
  return {
    reason,
    riskLevel: (decision.includes('fraud') || decision.includes('trust') ? 'high' : 'medium') as 'low' | 'medium' | 'high',
    requestedAction: decision,
    agentRecommendation: reason,
    confidence: typeof outcome.confidence === 'number' ? outcome.confidence : null,
    appliedRuleIds: Array.isArray(outcome.appliedRuleIds) ? outcome.appliedRuleIds.map(String) : [],
  };
}
