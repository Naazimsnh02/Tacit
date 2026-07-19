import {
  evaluationMatchCategorySchema, impactMetricsSchema, testCaseSchema, type EvaluationMatchCategory, type ImpactMetrics, type TestCase,
} from '@tacit/core-schemas';
import type { WorkflowRegistry } from '@tacit/workflow-registry';

export interface EvaluationRepository {
  getBuild(input: { projectId: string; buildId?: string }): Promise<{ id: string; workflowVersionId: string; workflowType: string } | null>;
  getTestCases(projectId: string): Promise<readonly TestCase[]>;
  createRun(input: { projectId: string; workflowVersionId: string; agentBuildId: string }): Promise<{ id: string }>;
  saveResult(input: {
    testRunId: string; testCaseId: string; status: 'passed' | 'failed'; actualOutcome: Record<string, unknown> | null;
    message: string | null; matchCategory: EvaluationMatchCategory; appliedRuleIds: readonly string[]; evidenceIds: readonly string[];
    confidence: number | null; failureExplanation: string | null; suggestedNextStep: string | null;
  }): Promise<void>;
  completeRun(input: { testRunId: string; status: 'passed' | 'failed' }): Promise<void>;
  getWorkflowSummary(workflowVersionId: string): Promise<{ stepCount: number; ruleCount: number } | null>;
  saveImpactSnapshot(input: Omit<ImpactMetrics, 'id'>): Promise<void>;
}

export interface AgentExecutor {
  execute(buildId: string, payload: Record<string, unknown>): Promise<{ outcome: Record<string, unknown> | null; error: string | null }>;
}

export class EvaluationInputError extends Error {}

export type EvaluationMetrics = {
  totalCases: number; exactMatches: number; acceptableAlternatives: number; correctEscalations: number;
  incorrectCases: number; needsClarification: number; executionFailures: number; safeAutomationCoverage: number;
  humanReviewRate: number; unsafeFailureRate: number; averageConfidence: number | null;
};

export async function replayHistoricalCases(input: {
  projectId: string; buildId?: string; registry: WorkflowRegistry; repository: EvaluationRepository; executor: AgentExecutor;
}): Promise<{ testRunId: string; metrics: EvaluationMetrics }> {
  const build = await input.repository.getBuild({ projectId: input.projectId, buildId: input.buildId });
  if (!build) throw new EvaluationInputError('A successful generated build is required before historical replay.');
  // Pack lookup remains only for optional domain evaluateCase helpers. Case I/O is process-agnostic.
  const pack = input.registry.get(build.workflowType);
  const testCases = await input.repository.getTestCases(input.projectId);
  if (testCases.length === 0) throw new EvaluationInputError('This project has no historical cases to replay.');
  const run = await input.repository.createRun({ projectId: input.projectId, workflowVersionId: build.workflowVersionId, agentBuildId: build.id });
  const categories: EvaluationMatchCategory[] = [];
  const confidences: number[] = [];
  try {
    for (const rawTestCase of testCases) {
      const testCase = testCaseSchema.parse(rawTestCase);
      let outcome: Record<string, unknown> | null = null;
      let executionError: string | null = null;
      if (!testCase.input || typeof testCase.input !== 'object' || Array.isArray(testCase.input) || Object.keys(testCase.input).length === 0) {
        executionError = 'The historical case input must be a non-empty JSON object.';
      } else {
        const execution = await input.executor.execute(build.id, testCase.input as Record<string, unknown>);
        outcome = execution.outcome;
        executionError = execution.error;
        if (outcome && (typeof outcome !== 'object' || Array.isArray(outcome))) {
          executionError = 'The generated agent did not return a JSON object outcome.';
          outcome = null;
        }
      }
      const assessment = pack.evaluateCase?.({ testCase, actualOutcome: outcome, executionError }) ?? defaultAssessment(testCase, outcome, executionError);
      const category = evaluationMatchCategorySchema.parse(assessment.matchCategory);
      categories.push(category);
      if (assessment.confidence !== null) confidences.push(assessment.confidence);
      await input.repository.saveResult({
        testRunId: run.id, testCaseId: testCase.id, status: isPassing(category) ? 'passed' : 'failed', actualOutcome: outcome,
        message: assessment.failureExplanation, matchCategory: category, appliedRuleIds: assessment.appliedRuleIds,
        evidenceIds: assessment.evidenceIds, confidence: assessment.confidence, failureExplanation: assessment.failureExplanation,
        suggestedNextStep: assessment.suggestedNextStep,
      });
    }
    const metrics = calculateEvaluationMetrics(categories, confidences);
    await input.repository.completeRun({ testRunId: run.id, status: metrics.incorrectCases + metrics.executionFailures === 0 ? 'passed' : 'failed' });
    const workflow = await input.repository.getWorkflowSummary(build.workflowVersionId);
    await input.repository.saveImpactSnapshot(createReplayImpactSnapshot({
      projectId: input.projectId, workflowVersionId: build.workflowVersionId, metrics,
      stepCount: workflow?.stepCount ?? 0, ruleCount: workflow?.ruleCount ?? 0,
    }));
    return { testRunId: run.id, metrics };
  } catch (error) {
    await input.repository.completeRun({ testRunId: run.id, status: 'failed' });
    throw error;
  }
}

/**
 * Replay supplies observed quality measures. Time and step counts are clearly
 * labelled estimates because production does not yet capture time-on-task.
 */
export function createReplayImpactSnapshot(input: {
  projectId: string; workflowVersionId: string; metrics: EvaluationMetrics; stepCount: number; ruleCount: number;
}): Omit<ImpactMetrics, 'id'> {
  const safeCases = input.metrics.exactMatches + input.metrics.acceptableAlternatives + input.metrics.correctEscalations;
  const estimatedManualMinutes = input.metrics.totalCases * 18;
  const estimatedMinutesSaved = Number((safeCases * 15).toFixed(1));
  const estimatedAutomatedMinutes = Number(Math.max(0, estimatedManualMinutes - estimatedMinutesSaved).toFixed(1));
  const automatedSteps = Math.round(input.stepCount * (input.metrics.safeAutomationCoverage / 100));
  return impactMetricsSchema.omit({ id: true }).parse({
    projectId: input.projectId, workflowVersionId: input.workflowVersionId,
    observedCases: input.metrics.totalCases, automationCoveragePercent: input.metrics.safeAutomationCoverage,
    accuracyPercent: input.metrics.safeAutomationCoverage, estimatedMinutesSaved,
    manualSteps: input.stepCount, automatedSteps, aiAssistedSteps: Math.round(input.stepCount * (input.metrics.humanReviewRate / 100)),
    humanRequiredSteps: Math.max(0, input.stepCount - automatedSteps), manualHandlingMinutes: estimatedManualMinutes,
    estimatedAutomatedMinutes, reviewRatePercent: input.metrics.humanReviewRate, rulesDiscovered: input.ruleCount,
    undocumentedExceptions: 0,
    sources: {
      observedCases: 'observed', automationCoveragePercent: 'observed', accuracyPercent: 'observed', reviewRatePercent: 'observed',
      estimatedMinutesSaved: 'estimated', manualSteps: 'estimated', automatedSteps: 'estimated', aiAssistedSteps: 'estimated',
      humanRequiredSteps: 'estimated', manualHandlingMinutes: 'estimated', estimatedAutomatedMinutes: 'estimated',
      rulesDiscovered: 'observed', undocumentedExceptions: 'estimated',
    },
    assumptions: [
      'Historical replay outcomes are observed from the current promoted build.',
      'Handling-time estimates use 18 manual minutes and 3 assisted minutes for each safely handled case.',
      'Step allocation is estimated from the confirmed workflow specification and replay coverage.',
      'Undocumented exceptions are not inferred from replay until they are explicitly recorded.',
    ],
    capturedAt: new Date().toISOString(),
  });
}

function defaultAssessment(testCase: TestCase, outcome: Record<string, unknown> | null, executionError: string | null) {
  if (executionError) return { matchCategory: 'execution_failure' as const, appliedRuleIds: [], evidenceIds: testCase.evidenceIds, confidence: null, failureExplanation: executionError, suggestedNextStep: 'Inspect the build output and rerun the case.' };
  if (outcomesMatch(outcome, testCase.expectedOutcome)) {
    return { matchCategory: 'exact_match' as const, appliedRuleIds: [], evidenceIds: testCase.evidenceIds, confidence: 1, failureExplanation: null, suggestedNextStep: null };
  }
  // Decision-aligned human-review paths count as correct escalations when the label also required review.
  if (isHumanReviewDecision(outcome?.decision) && isHumanReviewDecision(testCase.expectedOutcome.decision)) {
    return {
      matchCategory: 'correct_escalation' as const,
      appliedRuleIds: [],
      evidenceIds: testCase.evidenceIds,
      confidence: 0.9,
      failureExplanation: null,
      suggestedNextStep: null,
    };
  }
  return { matchCategory: 'incorrect' as const, appliedRuleIds: [], evidenceIds: testCase.evidenceIds, confidence: 0, failureExplanation: 'The generated outcome differs from the labelled historical outcome.', suggestedNextStep: 'Review the case and add the corrected behavior to the generated agent.' };
}

function outcomesMatch(actual: Record<string, unknown> | null, expected: Record<string, unknown>): boolean {
  if (!actual) return false;
  if (JSON.stringify(actual) === JSON.stringify(expected)) return true;
  // Process-agnostic: match on decision (+ reason when both present) without requiring identical extra keys.
  const actualDecision = normalizeDecision(actual.decision);
  const expectedDecision = normalizeDecision(expected.decision);
  if (!actualDecision || !expectedDecision || actualDecision !== expectedDecision) return false;
  const actualReason = typeof actual.reason === 'string' ? actual.reason.trim() : null;
  const expectedReason = typeof expected.reason === 'string' ? expected.reason.trim() : null;
  if (actualReason && expectedReason) return actualReason === expectedReason;
  return true;
}

function normalizeDecision(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function isHumanReviewDecision(value: unknown): boolean {
  const decision = normalizeDecision(value);
  if (!decision) return false;
  return decision.includes('approval') || decision.includes('escalate') || decision.includes('hold') || decision.includes('review') || decision.includes('trust');
}

function isPassing(category: EvaluationMatchCategory) {
  return ['exact_match', 'acceptable_alternative', 'correct_escalation'].includes(category);
}

export function calculateEvaluationMetrics(categories: readonly EvaluationMatchCategory[], confidences: readonly number[]): EvaluationMetrics {
  const count = (category: EvaluationMatchCategory) => categories.filter((item) => item === category).length;
  const totalCases = categories.length;
  const exactMatches = count('exact_match');
  const acceptableAlternatives = count('acceptable_alternative');
  const correctEscalations = count('correct_escalation');
  const incorrectCases = count('incorrect');
  const needsClarification = count('needs_clarification');
  const executionFailures = count('execution_failure');
  const safe = exactMatches + acceptableAlternatives + correctEscalations;
  return {
    totalCases, exactMatches, acceptableAlternatives, correctEscalations, incorrectCases, needsClarification, executionFailures,
    safeAutomationCoverage: percent(safe, totalCases), humanReviewRate: percent(correctEscalations + needsClarification, totalCases),
    unsafeFailureRate: percent(incorrectCases + executionFailures, totalCases),
    averageConfidence: confidences.length ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2)) : null,
  };
}

function percent(value: number, total: number) { return total === 0 ? 0 : Number(((value / total) * 100).toFixed(1)); }
