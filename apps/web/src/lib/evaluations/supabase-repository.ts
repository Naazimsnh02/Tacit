import type { TestCase } from '@tacit/core-schemas';
import type { EvaluationRepository } from './service';

interface Row { [key: string]: unknown }
function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

export class SupabaseEvaluationRepository implements EvaluationRepository {
  private readonly connection = config();
  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.connection.url}/rest/v1/${path}`, { ...init, headers: { apikey: this.connection.key, Authorization: `Bearer ${this.connection.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`Evaluation persistence failed (${response.status}).`);
    const text = await response.text(); return text ? JSON.parse(text) : null;
  }
  async getBuild(input: { projectId: string; buildId?: string }) {
    const filter = input.buildId ? `id=eq.${encodeURIComponent(input.buildId)}&` : '';
    const rows = await this.request(`agent_builds?${filter}project_id=eq.${encodeURIComponent(input.projectId)}&status=eq.succeeded&select=id,workflow_version_id,projects!inner(workflow_type)&order=created_at.desc&limit=1`) as Row[];
    const row = rows[0]; return row ? { id: String(row.id), workflowVersionId: String(row.workflow_version_id), workflowType: String((row.projects as Row).workflow_type) } : null;
  }
  async getTestCases(projectId: string) {
    const rows = await this.request(`test_cases?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=created_at.asc`) as Row[];
    return rows.map((row) => ({ id: String(row.id), projectId: String(row.project_id), label: String(row.label), input: row.input as Record<string, unknown>, expectedOutcome: row.expected_outcome as Record<string, unknown>, evidenceIds: (row.evidence_ids as string[]) ?? [], createdAt: String(row.created_at) })) as TestCase[];
  }
  async createRun(input: { projectId: string; workflowVersionId: string; agentBuildId: string }) {
    const rows = await this.request('test_runs', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ project_id: input.projectId, workflow_version_id: input.workflowVersionId, agent_build_id: input.agentBuildId, status: 'running', run_type: 'historical_replay', started_at: new Date().toISOString() }]) }) as Row[];
    return { id: String(rows[0]?.id) };
  }
  async saveResult(input: Parameters<EvaluationRepository['saveResult']>[0]) {
    await this.request('test_case_results', { method: 'POST', body: JSON.stringify([{ test_run_id: input.testRunId, test_case_id: input.testCaseId, status: input.status, actual_outcome: input.actualOutcome, message: input.message, match_category: input.matchCategory, applied_rule_ids: input.appliedRuleIds, evidence_ids: input.evidenceIds, confidence: input.confidence, failure_explanation: input.failureExplanation, suggested_next_step: input.suggestedNextStep }]) });
  }
  async completeRun(input: { testRunId: string; status: 'passed' | 'failed' }) { await this.request(`test_runs?id=eq.${encodeURIComponent(input.testRunId)}`, { method: 'PATCH', body: JSON.stringify({ status: input.status, completed_at: new Date().toISOString() }) }); }
}
