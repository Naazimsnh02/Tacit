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
 * Executes one evidence-linked case without writing replay results. Packs decide
 * whether a valid outcome needs approval, keeping domain policy outside core.
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
  const pack = input.registry.get(build.workflowType);
  const validatedInput = pack.inputSchema.safeParse(testCase.input);
  if (!validatedInput.success) throw new SupervisedCaseInputError('The selected case input does not satisfy this workflow pack.');
  const execution = await input.executor.execute(build.id, validatedInput.data as Record<string, unknown>);
  if (execution.error || !execution.outcome) throw new SupervisedCaseInputError(execution.error ?? 'The generated agent did not return an outcome.');
  const validOutcome = pack.outcomeSchema.safeParse(execution.outcome);
  if (!validOutcome.success) throw new SupervisedCaseInputError('The generated agent returned an invalid workflow outcome.');

  const approvalDraft = pack.approvalRequestForOutcome?.({
    caseInput: validatedInput.data as Record<string, unknown>, outcome: validOutcome.data as Record<string, unknown>, evidenceIds: testCase.evidenceIds,
  }) ?? null;
  if (!approvalDraft) return { outcome: validOutcome.data as Record<string, unknown>, approval: null };
  if (testCase.evidenceIds.length === 0) throw new SupervisedCaseInputError('A supervised case that requires approval must include evidence references.');
  const approval = await input.repository.saveRequest(approvalRequestSchema.omit({ id: true }).parse({
    projectId: input.projectId, workflowVersionId: build.workflowVersionId, status: 'pending',
    reason: approvalDraft.reason, riskLevel: approvalDraft.riskLevel, requestedAction: approvalDraft.requestedAction,
    agentRecommendation: approvalDraft.agentRecommendation, confidence: approvalDraft.confidence,
    appliedRuleIds: approvalDraft.appliedRuleIds, agentBuildId: build.id, evidenceIds: testCase.evidenceIds,
    payload: { caseId: testCase.id, caseLabel: testCase.label, input: validatedInput.data, outcome: validOutcome.data },
    createdAt: new Date().toISOString(),
  }), input.actorId);
  return { outcome: validOutcome.data as Record<string, unknown>, approval };
}
