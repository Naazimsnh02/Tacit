import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConfiguredAgentBuildModel } from './openai-codex-model';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('configured agent-build model', () => {
  it('validates a Codex subscription runner response before returning it', async () => {
    vi.stubEnv('LLM_BACKEND', 'codex_subscription');
    vi.stubEnv('CODEX_SUBSCRIPTION_RUNNER_URL', 'http://codex-runner:8100');
    vi.stubEnv('CODEX_SUBSCRIPTION_RUNNER_SECRET', 'a'.repeat(32));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: '{"agentSource":"def evaluate(payload):\\n    return {}\\n","testSource":"def test_safe():\\n    assert True\\n","summary":"Safe agent"}',
        model: 'gpt-5.4', response_id: 'turn-1', usage: { total_tokens: 42 },
      }),
    }));

    await expect(createConfiguredAgentBuildModel()?.generate('Generate a safe agent.')).resolves.toMatchObject({
      summary: 'Safe agent', responseId: 'turn-1', model: 'gpt-5.4', usage: { total_tokens: 42 },
    });
  });

  it('rejects a schema-invalid Codex subscription generation', async () => {
    vi.stubEnv('LLM_BACKEND', 'codex_subscription');
    vi.stubEnv('CODEX_SUBSCRIPTION_RUNNER_URL', 'http://codex-runner:8100');
    vi.stubEnv('CODEX_SUBSCRIPTION_RUNNER_SECRET', 'a'.repeat(32));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output: '{"agentSource":"only this"}', model: 'gpt-5.4' }) }));

    await expect(createConfiguredAgentBuildModel()?.generate('Generate a safe agent.')).rejects.toThrow('invalid generated-artifact contract');
  });
});
