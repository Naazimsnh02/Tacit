import { describe, expect, it } from 'vitest';
import { WorkflowRegistry } from '@tacit/workflow-registry';
import { createInvoiceReconstructionFallback, invoiceExceptionWorkflowPack, resolveInvoiceClarificationAnswer } from './index';
import type { ClarificationQuestionDraft } from '@tacit/core-schemas';

describe('invoice exception workflow pack', () => {
  it('registers through the generic workflow registry', () => {
    const registry = new WorkflowRegistry();
    registry.register(invoiceExceptionWorkflowPack);
    expect(registry.get('invoice_exception').name).toBe('Invoice Exception Review');
  });

  it('owns the configured observation panels, actions, and final outcomes', () => {
    expect(invoiceExceptionWorkflowPack.workspaceDefinition.panels.map((panel) => panel.label)).toEqual(expect.arrayContaining([
      'Invoice document', 'Purchase Order', 'Delivery Record', 'Vendor Email', 'Approval Matrix', 'SOP',
    ]));
    expect(invoiceExceptionWorkflowPack.supportedActions.map((action) => action.eventAction)).toEqual(expect.arrayContaining([
      'open_document', 'compare_values', 'check_approval_threshold', 'complete_review',
    ]));
    expect(invoiceExceptionWorkflowPack.workspaceDefinition.outcomes.map((outcome) => outcome.id)).toEqual([
      'approve', 'reject', 'escalate', 'request_information', 'manager_approval',
    ]);
  });

  it('removes resolved free-text clarification prompts from the next workflow version', () => {
    const reconstruction = createInvoiceReconstructionFallback({ evidenceIds: ['11111111-1111-4111-8111-111111111111'] });
    const conflictQuestion: ClarificationQuestionDraft = {
      id: 'resolve_approval_threshold_conflict', question: 'How should the agent resolve this conflict: The SOP threshold and the observed manager threshold differ.?',
      rationale: 'Invoices may be approved without the required escalation.', relatedRuleId: 'manager_threshold', evidenceIds: reconstruction.rules[0]!.evidenceIds,
      answerType: 'free_text', suggestedAnswers: [], riskIfUnanswered: 'Conflicting evidence could produce an unsafe outcome.',
    };
    const unknownQuestion: ClarificationQuestionDraft = {
      id: 'unknown_1', question: 'Which manager approval threshold is authoritative.', rationale: 'This unknown prevents a deterministic automation boundary.',
      relatedRuleId: null, evidenceIds: reconstruction.rules[0]!.evidenceIds, answerType: 'free_text', suggestedAnswers: [], riskIfUnanswered: 'The agent must escalate cases affected by this unknown.',
    };

    const conflictResolved = resolveInvoiceClarificationAnswer({ reconstruction, question: conflictQuestion, answer: '₹500,000' });
    expect(conflictResolved.contradictions).toHaveLength(0);
    expect(conflictResolved.rules.find((rule) => rule.id === 'manager_threshold')?.condition).toContain('500000');

    const fullyResolved = resolveInvoiceClarificationAnswer({ reconstruction: conflictResolved, question: unknownQuestion, answer: '₹500,000' });
    expect(fullyResolved.unknowns).toHaveLength(0);
  });

  it('preserves a confirmed manager threshold instead of replacing it with a boolean answer', () => {
    const reconstruction = createInvoiceReconstructionFallback({ evidenceIds: ['11111111-1111-4111-8111-111111111111'] });
    const question: ClarificationQuestionDraft = {
      id: 'confirm_manager_threshold', question: 'Should the generated agent apply this rule: Invoice value exceeds the applicable manager threshold.?',
      rationale: 'Confirm the inferred approval rule.', relatedRuleId: 'manager_threshold', evidenceIds: reconstruction.rules[1]!.evidenceIds,
      answerType: 'boolean', suggestedAnswers: [], riskIfUnanswered: 'Keep this behind human review.',
    };
    const resolved = resolveInvoiceClarificationAnswer({ reconstruction, question, answer: true });
    expect(resolved.rules.find((rule) => rule.id === 'manager_threshold')?.condition).toBe('Invoice value exceeds the applicable manager threshold.');
  });
});
