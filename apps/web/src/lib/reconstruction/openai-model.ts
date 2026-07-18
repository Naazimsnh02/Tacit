import { workflowReconstructionJsonSchema } from '@tacit/core-schemas';
import type { ReconstructionModel } from './service';
import { completeWithCodexSubscription, isCodexSubscriptionBackend } from '../llm/codex-subscription';

export function createConfiguredReconstructionModel(): ReconstructionModel | undefined {
  if (isCodexSubscriptionBackend()) {
    return {
      async reconstruct(prompt: string): Promise<unknown> {
        const response = await completeWithCodexSubscription({
          purpose: 'workflow_reconstruction',
          prompt: `${prompt}\n\nReturn only the requested JSON object. Do not call tools or include Markdown.`,
        });
        return JSON.parse(response.output) as unknown;
      },
    };
  }
  return createOpenAiReconstructionModel();
}

export function createOpenAiReconstructionModel(): ReconstructionModel | undefined {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_REASONING_MODEL;
  if (!apiKey || !model) return undefined;
  return {
    async reconstruct(prompt: string): Promise<unknown> {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, store: false, input: prompt,
          text: { format: { type: 'json_schema', name: 'tacit_workflow_reconstruction', strict: true, schema: workflowReconstructionJsonSchema } },
        }),
      });
      if (!response.ok) throw new Error(`Workflow model request failed (${response.status}).`);
      const payload = await response.json() as { output_text?: string };
      if (!payload.output_text) throw new Error('Workflow model returned no output.');
      return JSON.parse(payload.output_text) as unknown;
    },
  };
}
