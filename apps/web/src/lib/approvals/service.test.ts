import type { ApprovalAction, ApprovalRequest, ImpactMetrics } from '@tacit/core-schemas';
import { describe, expect, it } from 'vitest';
import { recordApprovalDecision, type ApprovalRepository } from './service';

const request: ApprovalRequest = {
  id: '11111111-1111-4111-8111-111111111111', projectId: '22222222-2222-4222-8222-222222222222', workflowVersionId: null,
  status: 'pending', reason: 'A configured risk threshold was exceeded.', riskLevel: 'high', requestedAction: 'Release the case',
  agentRecommendation: 'Request approval', confidence: 0.9, appliedRuleIds: ['threshold'], agentBuildId: null,
  evidenceIds: ['33333333-3333-4333-8333-333333333333'], payload: {}, createdAt: '2026-07-16T09:00:00.000Z',
};
class Repository implements ApprovalRepository {
  current = { ...request }; actions: Omit<ApprovalAction, 'id' | 'actedAt'>[] = [];
  async list() { return [this.current]; } async get() { return this.current; }
  async saveRequest() { return this.current; }
  async saveAction(input: Omit<ApprovalAction, 'id' | 'actedAt'>) { this.actions.push(input); return { id: '44444444-4444-4444-8444-444444444444', ...input, actedAt: '2026-07-16T09:01:00.000Z' }; }
  async updateStatus(_id: string, status: ApprovalRequest['status']) { this.current = { ...this.current, status }; }
  async latestImpact(): Promise<ImpactMetrics | null> { return null; }
}

describe('approval decisions', () => {
  it('persists a demo approver action and resolves approve/reject requests', async () => {
    const repository = new Repository();
    await recordApprovalDecision(repository, request.id, { decision: 'approved', comment: 'Evidence reviewed.', approver: 'Manager' });
    expect(repository.current.status).toBe('approved');
    expect(repository.actions[0]).toMatchObject({ decision: 'approved', approver: 'Manager' });
  });
  it('keeps request-more-information open for follow-up', async () => {
    const repository = new Repository();
    await recordApprovalDecision(repository, request.id, { decision: 'request_more_information' });
    expect(repository.current.status).toBe('pending');
    expect(repository.actions[0]?.approver).toBe('Demo approver');
  });
});
