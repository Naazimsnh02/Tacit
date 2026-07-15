import { describe, expect, it } from 'vitest';
import { observationSessionStatusSchema, projectSchema, workflowTypeSchema } from './index';

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
});
