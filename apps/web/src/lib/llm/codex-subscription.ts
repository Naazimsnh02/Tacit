export type CodexSubscriptionPurpose = 'workflow_reconstruction' | 'agent_compilation';

export interface CodexSubscriptionResponse {
  readonly output: string;
  readonly model: string;
  readonly responseId: string | null;
  readonly usage: unknown;
}

export function isCodexSubscriptionBackend(): boolean {
  return process.env.LLM_BACKEND === 'codex_subscription';
}

export async function completeWithCodexSubscription(input: {
  readonly purpose: CodexSubscriptionPurpose;
  readonly prompt: string;
}): Promise<CodexSubscriptionResponse> {
  const baseUrl = process.env.CODEX_SUBSCRIPTION_RUNNER_URL;
  const secret = process.env.CODEX_SUBSCRIPTION_RUNNER_SECRET;
  if (!baseUrl || !secret) throw new Error('Codex subscription runner is not configured.');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/codex/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tacit-Codex-Runner-Secret': secret },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { detail?: unknown; output?: unknown; model?: unknown; response_id?: unknown; usage?: unknown } | null;
  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === 'string' ? detail : `Codex subscription runner failed (${response.status}).`);
  }
  if (!payload || typeof payload.output !== 'string' || !payload.output.trim() || typeof payload.model !== 'string') {
    throw new Error('Codex subscription runner returned an invalid response.');
  }
  return { output: payload.output, model: payload.model, responseId: typeof payload.response_id === 'string' ? payload.response_id : null, usage: payload.usage ?? null };
}
