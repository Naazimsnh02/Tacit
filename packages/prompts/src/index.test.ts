import { describe, expect, it } from 'vitest';
import { createAgentCompilationPrompt, createWorkflowReconstructionPrompt, rankSourceInsightsForReconstruction } from './index';

describe('agent compilation prompt', () => {
  it('requires the stable replay entrypoint and a JSON-object outcome', () => {
    const prompt = createAgentCompilationPrompt({
      specification: {
        name: 'Test workflow', version: '1', description: 'A test workflow', workflowVersionId: '11111111-1111-4111-8111-111111111111',
        inputs: [], steps: [], rules: [], approvalPolicy: {}, escalationPolicy: { conditions: [] }, outputSchema: [], auditPolicy: { evidenceRequired: true, retainDecisionTrace: true }, testCaseIds: [],
      },
      repair: null,
    });

    expect(prompt).toContain("def evaluate(payload)");
    expect(prompt).toContain('JSON-serializable dictionary');
  });
});

describe('workflow reconstruction prompt', () => {
  it('ranks package and process insights ahead of flat facts', () => {
    const ranked = rankSourceInsightsForReconstruction([
      { kind: 'fact', createdAt: '2026-07-18T00:00:02.000Z' },
      { kind: 'package_suggested_step', createdAt: '2026-07-18T00:00:03.000Z' },
      { kind: 'process_decision', createdAt: '2026-07-18T00:00:01.000Z' },
      { kind: 'summary', createdAt: '2026-07-18T00:00:00.000Z' },
    ]);
    expect(ranked.map((item) => item.kind)).toEqual([
      'package_suggested_step',
      'process_decision',
      'summary',
      'fact',
    ]);
  });

  it('instructs the model to prefer process-first package synthesis', () => {
    const prompt = createWorkflowReconstructionPrompt({
      promptContext: 'Domain-neutral workflow.',
      session: { id: 'session' },
      events: [],
      evidence: [],
      sourceInsights: [{ kind: 'package_policy_rule', content: 'amount > 500 → approve', extractionIds: ['11111111-1111-4111-8111-111111111111'] }],
      finalDecision: null,
    });
    expect(prompt).toContain('package_* and process_*');
    expect(prompt).toContain('package_policy_rule');
    expect(prompt).toContain('process-first ranking');
  });
});
