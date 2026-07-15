import type { AgentExecutor } from './service';

export class RuntimeAgentExecutor implements AgentExecutor {
  constructor(private readonly baseUrl = process.env.AGENT_RUNTIME_URL) {}
  async execute(buildId: string, payload: Record<string, unknown>) {
    if (!this.baseUrl) return { outcome: null, error: 'Agent runtime is not configured.' };
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/runtime/builds/${encodeURIComponent(buildId)}/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload }) });
      if (!response.ok) return { outcome: null, error: 'The generated agent could not execute this historical case.' };
      const report = await response.json() as { status?: string; stdout?: string; stderr?: string };
      if (report.status !== 'passed') return { outcome: null, error: report.stderr || 'The generated agent execution failed.' };
      const output = JSON.parse(report.stdout ?? '') as unknown;
      return output && typeof output === 'object' && !Array.isArray(output) ? { outcome: output as Record<string, unknown>, error: null } : { outcome: null, error: 'The generated agent did not return an object outcome.' };
    } catch { return { outcome: null, error: 'The agent runtime is unavailable.' }; }
  }
}
