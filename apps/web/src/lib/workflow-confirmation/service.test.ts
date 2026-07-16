import { describe, expect, it } from 'vitest';
import { createInvoiceReconstructionFallback } from '@tacit/workflow-invoice-exception';
import { confirmWorkflow, WorkflowConfirmationError, type WorkflowConfirmationRepository } from './service';

const projectId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const evidenceId = '44444444-4444-4444-8444-444444444444';

class Repository implements WorkflowConfirmationRepository {
  saved = false;
  constructor(private readonly openQuestions = 0, private readonly confirmed = true) {}
  async getWorkflowVersion() {
    const reconstruction = createInvoiceReconstructionFallback({ evidenceIds: [evidenceId] });
    return { specification: { ...reconstruction, rules: reconstruction.rules.map((rule) => ({ ...rule, verificationStatus: this.confirmed ? 'confirmed' as const : 'inferred' as const })) } };
  }
  async getOpenClarificationCount() { return this.openQuestions; }
  async saveConfirmation() { this.saved = true; }
}

const attestation = { rulesConfirmed: true as const, contradictionsReviewed: true as const, automationBoundariesConfirmed: true as const, approvalPoliciesConfirmed: true as const };

describe('workflow confirmation', () => {
  it('persists a complete SME attestation only after all rules and clarifications are resolved', async () => {
    const repository = new Repository();
    const confirmation = await confirmWorkflow({ projectId, workflowVersionId: versionId, actorId, confirmation: attestation, repository, now: new Date('2026-07-17T10:00:00.000Z') });
    expect(confirmation.confirmedBy).toBe(actorId);
    expect(repository.saved).toBe(true);
  });

  it('rejects confirmation while a clarification remains open', async () => {
    await expect(confirmWorkflow({ projectId, workflowVersionId: versionId, actorId, confirmation: attestation, repository: new Repository(1) })).rejects.toBeInstanceOf(WorkflowConfirmationError);
  });

  it('rejects confirmation while an inferred rule remains', async () => {
    await expect(confirmWorkflow({ projectId, workflowVersionId: versionId, actorId, confirmation: attestation, repository: new Repository(0, false) })).rejects.toBeInstanceOf(WorkflowConfirmationError);
  });
});
