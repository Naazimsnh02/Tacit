import type { ApprovalRequest, TestCase } from '@tacit/core-schemas';
import { describe, expect, it } from 'vitest';
import { createWorkflowRegistry } from '../workflow-packs';
import { executeSupervisedCase, type SupervisedCaseRepository } from './supervised-case';

const projectId = '11111111-1111-4111-8111-111111111111';
const testCase: TestCase = {
  id: '22222222-2222-4222-8222-222222222222', projectId, label: 'High-value invoice',
  input: { invoiceReference: 'INV-1', purchaseOrderReference: 'PO-1', invoiceQuantity: 2, purchaseOrderQuantity: 2, invoiceUnitPrice: 100, purchaseOrderUnitPrice: 100, deliveryConfirmed: true, invoiceValue: 725000, duplicateInvoice: false, emailApproval: 'none' },
  expectedOutcome: { decision: 'manager_approval', reason: 'Value exceeds the configured threshold.' },
  evidenceIds: ['33333333-3333-4333-8333-333333333333'], createdAt: '2026-07-18T09:00:00.000Z',
};

class Repository implements SupervisedCaseRepository {
  requests: Omit<ApprovalRequest, 'id'>[] = [];
  async getBuild() { return { id: '44444444-4444-4444-8444-444444444444', workflowVersionId: '55555555-5555-4555-8555-555555555555', workflowType: 'invoice_exception' }; }
  async getTestCase() { return testCase; }
  async saveRequest(input: Omit<ApprovalRequest, 'id'>) { this.requests.push(input); return { id: '66666666-6666-4666-8666-666666666666', ...input }; }
}

describe('supervised case execution', () => {
  it('creates an evidence-backed approval only when the workflow pack returns human review', async () => {
    const repository = new Repository();
    const result = await executeSupervisedCase({ projectId, testCaseId: testCase.id, registry: createWorkflowRegistry(), repository,
      executor: { async execute() { return { outcome: { decision: 'human_review', reason: 'Manager approval is required.' }, error: null }; } },
    });
    expect(result.approval?.status).toBe('pending');
    expect(repository.requests[0]).toMatchObject({ riskLevel: 'high', agentBuildId: '44444444-4444-4444-8444-444444444444', evidenceIds: testCase.evidenceIds });
  });

  it('does not create approval work for a non-review outcome', async () => {
    const repository = new Repository();
    const result = await executeSupervisedCase({ projectId, testCaseId: testCase.id, registry: createWorkflowRegistry(), repository,
      executor: { async execute() { return { outcome: { decision: 'approve', reason: 'Safe to proceed.' }, error: null }; } },
    });
    expect(result.approval).toBeNull();
    expect(repository.requests).toHaveLength(0);
  });
});
