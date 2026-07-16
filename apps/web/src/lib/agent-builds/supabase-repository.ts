import type { AgentBuildRepository } from './service';

interface Row { [key: string]: unknown }

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

export class SupabaseAgentBuildRepository implements AgentBuildRepository {
  private readonly connection = config();

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.connection.url}/rest/v1/${path}`, { ...init, headers: { apikey: this.connection.key, Authorization: `Bearer ${this.connection.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`Agent build persistence failed (${response.status}).`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async getWorkflowVersion(id: string, projectId: string) {
    const rows = await this.request(`workflow_versions?id=eq.${encodeURIComponent(id)}&project_id=eq.${encodeURIComponent(projectId)}&select=id,project_id,version,specification,projects!inner(workflow_type,mode,organization_id)`) as Row[];
    const row = rows[0];
    const project = row?.projects as Row | undefined;
    return row && project ? { id: String(row.id), projectId: String(row.project_id), organizationId: String(project.organization_id), version: Number(row.version), specification: row.specification, workflowType: String(project.workflow_type), mode: project.mode === 'demo' ? 'demo' as const : 'production' as const } : null;
  }
  async hasWorkflowConfirmation(input: { workflowVersionId: string; projectId: string }) {
    const rows = await this.request(`workflow_confirmations?workflow_version_id=eq.${encodeURIComponent(input.workflowVersionId)}&project_id=eq.${encodeURIComponent(input.projectId)}&select=workflow_version_id&limit=1`) as Row[];
    return rows.length > 0;
  }
  async getTestCaseIds(projectId: string) {
    const rows = await this.request(`test_cases?project_id=eq.${encodeURIComponent(projectId)}&select=id&order=created_at.asc`) as Row[];
    return rows.map((row) => String(row.id));
  }
  async createBuild(input: { projectId: string; workflowVersionId: string; requestedBy: string | null }) {
    const rows = await this.request('agent_builds', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ project_id: input.projectId, workflow_version_id: input.workflowVersionId, requested_by: input.requestedBy, status: 'queued', promotion_status: 'pending' }]) }) as Row[];
    return { id: String(rows[0]?.id) };
  }
  async markBuildRunning(agentBuildId: string) { await this.request(`agent_builds?id=eq.${encodeURIComponent(agentBuildId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'running' }) }); }
  async saveLog(input: { agentBuildId: string; stage: string; message: string }) { await this.request('agent_build_logs', { method: 'POST', body: JSON.stringify([{ agent_build_id: input.agentBuildId, stage: input.stage, message: input.message }]) }); }
  async completeBuild(input: { agentBuildId: string; artifactPath: string; manifest: Record<string, unknown> }) { await this.request(`agent_builds?id=eq.${encodeURIComponent(input.agentBuildId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'succeeded', artifact_path: input.artifactPath, manifest: input.manifest, completed_at: new Date().toISOString() }) }); }
  async failBuild(input: { agentBuildId: string; reason: string; manifest: Record<string, unknown> }) { await this.request(`agent_builds?id=eq.${encodeURIComponent(input.agentBuildId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', failure_reason: input.reason, manifest: input.manifest, completed_at: new Date().toISOString() }) }); }
  async createRepairProposal(input: { agentBuildId: string; kind: 'repair_proposal' | 'clarification'; summary: string; details: Record<string, unknown> }) { await this.request('agent_build_repairs', { method: 'POST', body: JSON.stringify([{ agent_build_id: input.agentBuildId, kind: input.kind, summary: input.summary, details: input.details }]) }); }
}
