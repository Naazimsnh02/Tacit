import type { WorkflowConfirmation } from '@tacit/core-schemas';
import type { WorkflowConfirmationRepository } from './service';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

export class SupabaseWorkflowConfirmationRepository implements WorkflowConfirmationRepository {
  private readonly connection = config();
  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.connection.url}/rest/v1/${path}`, { ...init, headers: { apikey: this.connection.key, Authorization: `Bearer ${this.connection.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error('Workflow confirmation persistence failed.');
    const text = await response.text(); return text ? JSON.parse(text) : null;
  }
  async getWorkflowVersion(input: { projectId: string; workflowVersionId: string }) {
    const rows = await this.request(`workflow_versions?id=eq.${encodeURIComponent(input.workflowVersionId)}&project_id=eq.${encodeURIComponent(input.projectId)}&select=specification`) as Array<{ specification: unknown }>;
    return rows[0] ?? null;
  }
  async getOpenClarificationCount(workflowVersionId: string) {
    const rows = await this.request(`clarification_questions?workflow_version_id=eq.${encodeURIComponent(workflowVersionId)}&status=eq.open&select=id`) as unknown[];
    return rows.length;
  }
  async saveConfirmation(value: WorkflowConfirmation) {
    await this.request('workflow_confirmations', { method: 'POST', body: JSON.stringify([{
      workflow_version_id: value.workflowVersionId, project_id: value.projectId, confirmed_by: value.confirmedBy,
      rules_confirmed: value.rulesConfirmed, contradictions_reviewed: value.contradictionsReviewed,
      automation_boundaries_confirmed: value.automationBoundariesConfirmed,
      approval_policies_confirmed: value.approvalPoliciesConfirmed, created_at: value.createdAt,
    }]) });
  }
}
