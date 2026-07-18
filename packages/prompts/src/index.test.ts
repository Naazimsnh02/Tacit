import { describe, expect, it } from 'vitest';
import { createAgentCompilationPrompt } from './index';

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
