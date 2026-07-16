import { codexGenerationSchema, type CodexGeneration, type CodexModel } from './service';

interface ResponsesPayload {
  readonly id?: unknown;
  readonly model?: unknown;
  readonly output_text?: unknown;
  readonly output?: readonly { readonly type?: unknown; readonly content?: readonly { readonly type?: unknown; readonly refusal?: unknown }[] }[];
  readonly usage?: unknown;
}

const responseSchema = {
  type: 'object', additionalProperties: false,
  required: ['agentSource', 'testSource', 'summary'],
  properties: {
    agentSource: { type: 'string', minLength: 1, maxLength: 131072 },
    testSource: { type: 'string', minLength: 1, maxLength: 131072 },
    summary: { type: 'string', minLength: 1, maxLength: 4000 },
  },
};

/** Calls the configured Codex-capable model through Responses with a strict output contract. */
export function createOpenAiCodexModel(): CodexModel | undefined {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_CODEX_MODEL;
  if (!apiKey || !model) return undefined;
  return {
    async generate(prompt): Promise<CodexGeneration> {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, store: false, input: prompt,
          text: { format: { type: 'json_schema', name: 'tacit_agent_build', strict: true, schema: responseSchema } },
        }),
      });
      if (!response.ok) throw new Error(`Codex compilation request failed (${response.status}).`);
      const payload = await response.json() as ResponsesPayload;
      if (typeof payload.output_text !== 'string') {
        const refusal = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'refusal')?.refusal;
        throw new Error(typeof refusal === 'string' ? `Codex declined this build: ${refusal}` : 'Codex returned no structured build output.');
      }
      const parsed = codexGenerationSchema.safeParse(JSON.parse(payload.output_text));
      if (!parsed.success) throw new Error('Codex returned an invalid generated-artifact contract.');
      return { ...parsed.data, responseId: typeof payload.id === 'string' ? payload.id : null, model: typeof payload.model === 'string' ? payload.model : model, usage: payload.usage ?? null };
    },
  };
}
