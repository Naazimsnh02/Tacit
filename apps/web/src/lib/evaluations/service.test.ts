import { describe, expect, it } from 'vitest';
import { invoiceExceptionSeedData } from '@tacit/workflow-invoice-exception';
import { createWorkflowRegistry } from '../workflow-packs';
import { calculateEvaluationMetrics, replayHistoricalCases, type EvaluationRepository } from './service';

const projectId = invoiceExceptionSeedData.project.id;
class Repository implements EvaluationRepository {
  results: Parameters<EvaluationRepository['saveResult']>[0][] = [];
  completed: string | null = null;
  async getBuild() { return { id: '55555555-5555-4555-8555-555555555555', workflowVersionId: '66666666-6666-4666-8666-666666666666', workflowType: 'invoice_exception' }; }
  async getTestCases() { return invoiceExceptionSeedData.testCases; }
  async createRun() { return { id: '77777777-7777-4777-8777-777777777777' }; }
  async saveResult(input: Parameters<EvaluationRepository['saveResult']>[0]) { this.results.push(input); }
  async completeRun(input: { status: 'passed' | 'failed' }) { this.completed = input.status; }
}

describe('historical replay evaluation', () => {
  it('replays and persists all ten workflow-pack fixtures with inspectable outcome traces', async () => {
    const repository = new Repository();
    const result = await replayHistoricalCases({
      projectId, registry: createWorkflowRegistry(), repository,
      executor: { async execute(_buildId, payload) { return { outcome: { decision: payload.deliveryConfirmed === false ? 'approve' : 'human_review', reason: 'Generated output' }, error: null }; } },
    });
    expect(result.metrics.totalCases).toBe(10);
    expect(repository.results).toHaveLength(10);
    expect(repository.results.some((item) => item.matchCategory === 'incorrect')).toBe(true);
    expect(repository.results.find((item) => item.testCaseId.endsWith('006'))?.appliedRuleIds).toContain('delivery_confirmation_required');
    expect(repository.completed).toBe('failed');
  });

  it('calculates evaluation metrics without workflow-specific fields', () => {
    expect(calculateEvaluationMetrics(['exact_match', 'correct_escalation', 'incorrect', 'needs_clarification'], [1, 0.7, 0.1, 0.5])).toMatchObject({ totalCases: 4, exactMatches: 1, correctEscalations: 1, incorrectCases: 1, needsClarification: 1, safeAutomationCoverage: 50, humanReviewRate: 50, unsafeFailureRate: 25, averageConfidence: 0.57 });
  });
});
