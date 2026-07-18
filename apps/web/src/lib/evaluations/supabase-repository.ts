import type { ApprovalRequest, ImpactMetrics, TestCase } from '@tacit/core-schemas';
import type { EvaluationRepository } from './service';
import { SupabaseApprovalRepository } from '../approvals/supabase-repository';

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
    const rows = await this.request(`agent_builds?${filter}project_id=eq.${encodeURIComponent(input.projectId)}&status=eq.succeeded&promotion_status=eq.promoted&select=id,workflow_version_id,projects!inner(workflow_type)&order=created_at.desc&limit=1`) as Row[];
    const row = rows[0]; return row ? { id: String(row.id), workflowVersionId: String(row.workflow_version_id), workflowType: String((row.projects as Row).workflow_type) } : null;
  }
  async getTestCases(projectId: string) {
    const rows = await this.request(`test_cases?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=created_at.asc`) as Row[];
    return rows.map((row) => ({ id: String(row.id), projectId: String(row.project_id), label: String(row.label), input: row.input as Record<string, unknown>, expectedOutcome: row.expected_outcome as Record<string, unknown>, evidenceIds: (row.evidence_ids as string[]) ?? [], createdAt: String(row.created_at) })) as TestCase[];
  }
  async getTestCase(input: { projectId: string; testCaseId: string }) {
    const rows = await this.request(`test_cases?project_id=eq.${encodeURIComponent(input.projectId)}&id=eq.${encodeURIComponent(input.testCaseId)}&select=*&limit=1`) as Row[];
    const row = rows[0];
    return row ? { id: String(row.id), projectId: String(row.project_id), label: String(row.label), input: row.input as Record<string, unknown>, expectedOutcome: row.expected_outcome as Record<string, unknown>, evidenceIds: (row.evidence_ids as string[]) ?? [], createdAt: String(row.created_at) } as TestCase : null;
  }
  async createRun(input: { projectId: string; workflowVersionId: string; agentBuildId: string }) {
    const rows = await this.request('test_runs', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ project_id: input.projectId, workflow_version_id: input.workflowVersionId, agent_build_id: input.agentBuildId, status: 'running', run_type: 'historical_replay', started_at: new Date().toISOString() }]) }) as Row[];
    return { id: String(rows[0]?.id) };
  }
  async saveResult(input: Parameters<EvaluationRepository['saveResult']>[0]) {
    await this.request('test_case_results', { method: 'POST', body: JSON.stringify([{ test_run_id: input.testRunId, test_case_id: input.testCaseId, status: input.status, actual_outcome: input.actualOutcome, message: input.message, match_category: input.matchCategory, applied_rule_ids: input.appliedRuleIds, evidence_ids: input.evidenceIds, confidence: input.confidence, failure_explanation: input.failureExplanation, suggested_next_step: input.suggestedNextStep }]) });
  }
  async completeRun(input: { testRunId: string; status: 'passed' | 'failed' }) { await this.request(`test_runs?id=eq.${encodeURIComponent(input.testRunId)}`, { method: 'PATCH', body: JSON.stringify({ status: input.status, completed_at: new Date().toISOString() }) }); }
  async getWorkflowSummary(workflowVersionId: string) {
    const rows = await this.request(`workflow_versions?id=eq.${encodeURIComponent(workflowVersionId)}&select=specification&limit=1`) as Row[];
    const specification = rows[0]?.specification;
    if (!specification || typeof specification !== 'object' || Array.isArray(specification)) return null;
    const value = specification as Row;
    return { stepCount: Array.isArray(value.steps) ? value.steps.length : 0, ruleCount: Array.isArray(value.rules) ? value.rules.length : 0 };
  }
  async saveImpactSnapshot(input: Omit<ImpactMetrics, 'id'>) {
    await this.request('impact_snapshots', { method: 'POST', body: JSON.stringify([{
      project_id: input.projectId, workflow_version_id: input.workflowVersionId, observed_cases: input.observedCases,
      automation_coverage_percent: input.automationCoveragePercent, accuracy_percent: input.accuracyPercent,
      estimated_minutes_saved: input.estimatedMinutesSaved, manual_steps: input.manualSteps, automated_steps: input.automatedSteps,
      ai_assisted_steps: input.aiAssistedSteps, human_required_steps: input.humanRequiredSteps,
      manual_handling_minutes: input.manualHandlingMinutes, estimated_automated_minutes: input.estimatedAutomatedMinutes,
      review_rate_percent: input.reviewRatePercent, rules_discovered: input.rulesDiscovered,
      undocumented_exceptions: input.undocumentedExceptions, sources: input.sources, assumptions: input.assumptions,
      captured_at: input.capturedAt,
    }]) });
  }
}

export class SupabaseSupervisedCaseRepository extends SupabaseEvaluationRepository {
  private readonly approvals = new SupabaseApprovalRepository();
  async saveRequest(input: Omit<ApprovalRequest, 'id'>, requestedBy?: string) { return this.approvals.saveRequest(input, requestedBy); }
}
