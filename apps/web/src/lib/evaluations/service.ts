import {
  evaluationMatchCategorySchema, testCaseSchema, type EvaluationMatchCategory, type TestCase,
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
  const pack = input.registry.get(build.workflowType);
  const testCases = await input.repository.getTestCases(input.projectId);
  if (testCases.length === 0) throw new EvaluationInputError('This project has no historical cases to replay.');
  const run = await input.repository.createRun({ projectId: input.projectId, workflowVersionId: build.workflowVersionId, agentBuildId: build.id });
  const categories: EvaluationMatchCategory[] = [];
  const confidences: number[] = [];
  try {
    for (const rawTestCase of testCases) {
      const testCase = testCaseSchema.parse(rawTestCase);
      const validInput = pack.inputSchema.safeParse(testCase.input);
      let outcome: Record<string, unknown> | null = null;
      let executionError: string | null = null;
      if (!validInput.success) executionError = 'The historical case input does not satisfy this workflow pack.';
      else {
        const execution = await input.executor.execute(build.id, validInput.data as Record<string, unknown>);
        outcome = execution.outcome;
        executionError = execution.error;
        if (outcome && !pack.outcomeSchema.safeParse(outcome).success) {
          executionError = 'The generated agent returned an invalid workflow outcome.';
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
    return { testRunId: run.id, metrics };
  } catch (error) {
    await input.repository.completeRun({ testRunId: run.id, status: 'failed' });
    throw error;
  }
}

function defaultAssessment(testCase: TestCase, outcome: Record<string, unknown> | null, executionError: string | null) {
  if (executionError) return { matchCategory: 'execution_failure' as const, appliedRuleIds: [], evidenceIds: testCase.evidenceIds, confidence: null, failureExplanation: executionError, suggestedNextStep: 'Inspect the build output and rerun the case.' };
  if (JSON.stringify(outcome) === JSON.stringify(testCase.expectedOutcome)) return { matchCategory: 'exact_match' as const, appliedRuleIds: [], evidenceIds: testCase.evidenceIds, confidence: 1, failureExplanation: null, suggestedNextStep: null };
  return { matchCategory: 'incorrect' as const, appliedRuleIds: [], evidenceIds: testCase.evidenceIds, confidence: 0, failureExplanation: 'The generated outcome differs from the labelled historical outcome.', suggestedNextStep: 'Review the case and add the corrected behavior to the generated agent.' };
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
