import { describe, expect, it } from 'vitest';
import { clarificationQuestionDraftSchema, evaluationMatchCategorySchema, observationSessionStatusSchema, projectSchema, workflowSpecificationSchema, workflowTypeSchema } from './index';

describe('core schemas', () => {
  it('accepts workflow types without encoding a domain', () => {
    expect(workflowTypeSchema.parse('customer_support_escalation')).toBe('customer_support_escalation');
    expect(workflowTypeSchema.safeParse('invoice-exception').success).toBe(false);
  });

  it('validates a generic project without workflow-specific fields', () => {
    expect(projectSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111', name: 'A workflow', workflowType: 'customer_support_escalation',
      status: 'active', configuration: {}, createdAt: '2026-07-15T09:00:00.000Z', updatedAt: '2026-07-15T09:00:00.000Z',
    }).success).toBe(true);
  });

  it('supports a generic paused observation state', () => {
    expect(observationSessionStatusSchema.parse('paused')).toBe('paused');
  });

  it('classifies historical evaluation results without a workflow-specific field', () => {
    expect(evaluationMatchCategorySchema.parse('correct_escalation')).toBe('correct_escalation');
  });

  it('validates evidence-backed clarification metadata without workflow fields', () => {
    expect(clarificationQuestionDraftSchema.safeParse({
      id: 'confirm_policy', question: 'Which policy applies?', rationale: 'Sources conflict.', relatedRuleId: 'policy_rule',
      evidenceIds: ['11111111-1111-4111-8111-111111111111'], answerType: 'single_select',
      suggestedAnswers: [{ label: 'Documented policy', value: 'documented' }], riskIfUnanswered: 'Require review.',
    }).success).toBe(true);
  });

  it('validates a domain-agnostic executable workflow specification', () => {
    expect(workflowSpecificationSchema.safeParse({
      name: 'Support escalation', version: '1', description: 'Escalate safely.', workflowVersionId: '11111111-1111-4111-8111-111111111111',
      inputs: [{ name: 'ticket', type: 'string', required: true, description: 'Ticket reference.' }],
      steps: [{ id: 'review', title: 'Review', description: 'Review the ticket.', boundary: 'deterministic', evidenceIds: ['22222222-2222-4222-8222-222222222222'] }],
      rules: [{ id: 'urgent', name: 'Urgent escalation', description: 'Escalate urgent tickets.', condition: 'Ticket is urgent.', action: 'Escalate.', exceptions: [], riskLevel: 'medium', evidenceIds: ['22222222-2222-4222-8222-222222222222'], deterministic: true }],
      approvalPolicy: { type: 'escalation' }, escalationPolicy: { conditions: ['Escalate if urgent.'] },
      outputSchema: [{ name: 'escalated', type: 'boolean', required: true, description: 'Escalation result.' }],
      auditPolicy: { evidenceRequired: true, retainDecisionTrace: true }, testCaseIds: [],
    }).success).toBe(true);
  });
});
