import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConfiguredReconstructionModel } from './openai-model';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('configured reconstruction model', () => {
  it('uses the private Codex subscription runner when selected', async () => {
    vi.stubEnv('LLM_BACKEND', 'codex_subscription');
    vi.stubEnv('CODEX_SUBSCRIPTION_RUNNER_URL', 'http://codex-runner:8100/');
    vi.stubEnv('CODEX_SUBSCRIPTION_RUNNER_SECRET', 'a'.repeat(32));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output: '{"workflowObjective":"Review invoices"}', model: 'gpt-5.4' }),
    }));

    await expect(createConfiguredReconstructionModel()?.reconstruct('Extract a workflow.')).resolves.toEqual({ workflowObjective: 'Review invoices' });
    expect(fetch).toHaveBeenCalledWith('http://codex-runner:8100/codex/generate', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Tacit-Codex-Runner-Secret': 'a'.repeat(32) }),
    }));
  });

  it('uses a strict JSON Schema for direct Responses API reconstruction', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_REASONING_MODEL', 'gpt-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: '{"workflowObjective":"Review invoices"}' }) }));

    await createConfiguredReconstructionModel()?.reconstruct('Extract a workflow.');

    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.objectContaining({
      body: expect.stringContaining('"type":"json_schema"'),
    }));
  });
});
