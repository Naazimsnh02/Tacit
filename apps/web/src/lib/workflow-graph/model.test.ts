import { describe, expect, it } from 'vitest';
import { createInvoiceReconstructionFallback } from '@tacit/workflow-invoice-exception';
import { classifyRuleAutomation, createWorkflowGraph } from './model';

const evidenceId = '11111111-1111-4111-8111-111111111111';

describe('workflow graph model', () => {
  it('maps generic reconstruction steps and rules into inspectable graph nodes', () => {
    const graph = createWorkflowGraph(createInvoiceReconstructionFallback({ evidenceIds: [evidenceId] }));
    expect(graph.nodes.find((node) => node.type === 'start')).toBeDefined();
    expect(graph.nodes.find((node) => node.type === 'end')).toBeDefined();
    expect(graph.nodes.find((node) => node.id === 'rule:quantity_tolerance')?.detail.automationRecommendation).toBe('ai_prepare_human_approve');
    expect(graph.nodes.find((node) => node.id === 'rule:manager_threshold')?.type).toBe('approval');
    expect(graph.edges.some((edge) => edge.type === 'approval')).toBe(true);
  });

  it('keeps high-risk or unverified decisions behind a human boundary', () => {
    const reconstruction = createInvoiceReconstructionFallback({ evidenceIds: [evidenceId] });
    expect(classifyRuleAutomation(reconstruction.rules[1]!)).toBe('human_required');
  });
});
