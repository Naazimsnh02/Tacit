import { describe, expect, it } from 'vitest';
import { createInvoiceReconstructionFallback } from '@tacit/workflow-invoice-exception';
import { createRuleDiffPayloads } from './supabase-repository';

const evidenceId = '44444444-4444-4444-8444-444444444444';

describe('clarification Supabase repository', () => {
  it('records an added clarification rule with a non-null empty prior rule', () => {
    const before = createInvoiceReconstructionFallback({ evidenceIds: [evidenceId] }).rules;
    const after = [...before, {
      id: 'clarification_unknown_1', name: 'Expert clarification', condition: 'A policy decision is required.',
      action: 'Keep the decision supervised.', exceptions: [], confidence: 1, evidenceIds: [evidenceId],
      verificationStatus: 'confirmed' as const, riskLevel: 'high' as const,
    }];

    const diffs = createRuleDiffPayloads({ previousWorkflowVersionId: 'previous', workflowVersionId: 'next', before, after });

    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ rule_id: 'clarification_unknown_1', before_rule: {}, after_rule: { id: 'clarification_unknown_1' } });
  });
});
