import { describe, expect, it } from 'vitest';
import { createClarificationQuestions, answerClarificationQuestion, type ClarificationRepository } from './service';
import { createInvoiceReconstructionFallback } from '@tacit/workflow-invoice-exception';
import { createWorkflowRegistry } from '../workflow-packs';
import type { ClarificationAnswerValue, ClarificationQuestion, ClarificationQuestionDraft, WorkflowReconstruction } from '@tacit/core-schemas';

const projectId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const questionId = '33333333-3333-4333-8333-333333333333';
const evidenceId = '44444444-4444-4444-8444-444444444444';
const reconstruction = createInvoiceReconstructionFallback({ evidenceIds: [evidenceId] });

class Repository implements ClarificationRepository {
  readonly questions: ClarificationQuestion[] = [];
  saved: WorkflowReconstruction | null = null;
  stale = false;
  async getWorkflowVersion(id: string) { return id === versionId ? { id: versionId, projectId, version: 1, specification: reconstruction, workflowType: 'invoice_exception' } : null; }
  async getQuestion(id: string) { return this.questions.find((item) => item.id === id) ?? null; }
  async getQuestions() { return this.questions; }
  async saveQuestions(workflowVersionId: string, questions: readonly ClarificationQuestionDraft[]) {
    const created = questions.map((item, index) => ({ ...item, id: index === 0 ? questionId : `55555555-5555-4555-8555-55555555555${index}`, workflowVersionId, status: 'open' as const, answer: null, answerValue: null, createdAt: '2026-07-15T09:00:00.000Z', answeredAt: null }));
    this.questions.push(...created); return created;
  }
  async nextWorkflowVersion() { return 2; }
  async saveWorkflowVersion(value: { specification: WorkflowReconstruction }) { this.saved = value.specification; return { id: '66666666-6666-4666-8666-666666666666', version: 2 }; }
  async saveRules() {}
  async answerQuestion(id: string, answer: ClarificationAnswerValue) { const found = await this.getQuestion(id); if (found) Object.assign(found, { status: 'answered', answer: String(answer), answerValue: answer, answeredAt: '2026-07-15T10:00:00.000Z' }); }
  async saveRuleDiffs() {}
  async markBuildsStale() { this.stale = true; }
}

describe('clarification service', () => {
  it('creates high-value evidence-backed questions from gaps and conflicts', () => {
    const questions = createClarificationQuestions(reconstruction);
    expect(questions).toHaveLength(4);
    expect(questions.every((question) => question.evidenceIds.includes(evidenceId))).toBe(true);
    expect(questions.some((question) => question.id === 'resolve_approval_threshold_conflict')).toBe(true);
  });

  it('answers a question by creating a revised version and recording stale builds', async () => {
    const repository = new Repository();
    await repository.saveQuestions(versionId, createClarificationQuestions(reconstruction));
    const result = await answerClarificationQuestion({ questionId, answer: true, repository, registry: createWorkflowRegistry() });
    expect(result.version).toBe(2);
    expect(repository.saved?.rules.find((rule) => rule.id === 'quantity_tolerance')?.verificationStatus).toBe('confirmed');
    expect(repository.questions[0]?.status).toBe('answered');
    expect(repository.stale).toBe(true);
  });
});
