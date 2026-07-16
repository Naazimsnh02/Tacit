import type { AgentBuildRunner, GeneratedTestReport, StaticAnalysisReport } from './service';

interface RuntimeReport {
  readonly valid?: unknown; readonly errors?: unknown; readonly files_checked?: unknown;
  readonly status?: unknown; readonly exit_code?: unknown; readonly duration_ms?: unknown;
  readonly stdout?: unknown; readonly stderr?: unknown; readonly passed_tests?: unknown; readonly failed_tests?: unknown;
}

function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function numberOrNull(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

/** Phase 4 validation runner. Phase 5 replaces this host runtime with isolated execution. */
export class RuntimeAgentBuildRunner implements AgentBuildRunner {
  constructor(private readonly baseUrl = process.env.AGENT_RUNTIME_URL) {}

  async validate(buildId: string): Promise<StaticAnalysisReport> {
    const report = await this.request(buildId, 'validate');
    return { valid: report.valid === true, errors: Array.isArray(report.errors) ? report.errors.filter((item): item is string => typeof item === 'string') : [], filesChecked: typeof report.files_checked === 'number' ? report.files_checked : 0 };
  }

  async test(buildId: string): Promise<GeneratedTestReport> {
    const report = await this.request(buildId, 'test');
    return {
      status: report.status === 'passed' ? 'passed' : report.status === 'timed_out' ? 'timed_out' : 'failed', exitCode: numberOrNull(report.exit_code),
      durationMs: numberOrNull(report.duration_ms) ?? 0, stdout: text(report.stdout), stderr: text(report.stderr),
      passedTests: typeof report.passed_tests === 'number' ? report.passed_tests : 0, failedTests: typeof report.failed_tests === 'number' ? report.failed_tests : 0,
    };
  }

  private async request(buildId: string, operation: 'validate' | 'test'): Promise<RuntimeReport> {
    if (!this.baseUrl) throw new Error('The generated-code runtime is not configured.');
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/runtime/builds/${encodeURIComponent(buildId)}/${operation}`, { method: 'POST' });
    if (!response.ok) throw new Error(operation === 'validate' ? 'Generated code static analysis could not run.' : 'Generated tests could not run.');
    return response.json() as Promise<RuntimeReport>;
  }
}
