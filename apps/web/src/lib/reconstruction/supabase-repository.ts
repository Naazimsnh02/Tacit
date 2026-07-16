import type { ExtractedEvidence, ObservationSession, WorkflowEvent, WorkflowReconstruction } from '@tacit/core-schemas';
import type { ReconstructionRepository } from './service';

interface SupabaseRow { [key: string]: unknown; }

function requiredEnvironment(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

function mapSession(row: SupabaseRow): ObservationSession {
  return { id: String(row.id), projectId: String(row.project_id), status: row.status as ObservationSession['status'], startedAt: String(row.started_at), completedAt: row.completed_at === null ? null : String(row.completed_at), narration: row.narration === null ? null : String(row.narration), createdAt: String(row.created_at) };
}
function mapEvent(row: SupabaseRow): WorkflowEvent {
  return { id: String(row.id), observationSessionId: String(row.observation_session_id), source: row.source as WorkflowEvent['source'], action: String(row.action), occurredAt: String(row.occurred_at), payload: (row.payload ?? {}) as Record<string, unknown>, evidenceIds: Array.isArray(row.evidence_ids) ? row.evidence_ids.map(String) : [] };
}
function mapEvidence(row: SupabaseRow): ExtractedEvidence {
  return { id: String(row.id), artifactId: String(row.artifact_id), kind: row.kind as ExtractedEvidence['kind'], content: String(row.content), pageStart: row.page_start === null ? null : Number(row.page_start), pageEnd: row.page_end === null ? null : Number(row.page_end), timeStartMs: row.time_start_ms === null ? null : Number(row.time_start_ms), timeEndMs: row.time_end_ms === null ? null : Number(row.time_end_ms), confidence: Number(row.confidence), sourceArtifactVersion: String(row.source_artifact_version), createdAt: String(row.created_at) };
}

export class SupabaseReconstructionRepository implements ReconstructionRepository {
  private readonly config = requiredEnvironment();

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.config.url}/rest/v1/${path}`, { ...init, headers: { apikey: this.config.key, Authorization: `Bearer ${this.config.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`Workflow persistence failed (${response.status}).`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async getProject(projectId: string): Promise<{ id: string; workflowType: string; mode: 'production' | 'demo' } | null> {
    const rows = await this.request(`projects?id=eq.${encodeURIComponent(projectId)}&select=id,workflow_type,mode`) as SupabaseRow[];
    const row = rows[0];
    return row ? { id: String(row.id), workflowType: String(row.workflow_type), mode: row.mode === 'demo' ? 'demo' : 'production' } : null;
  }
  async getSession(sessionId: string, projectId: string): Promise<ObservationSession | null> {
    const rows = await this.request(`observation_sessions?id=eq.${encodeURIComponent(sessionId)}&project_id=eq.${encodeURIComponent(projectId)}&select=*`) as SupabaseRow[];
    return rows[0] ? mapSession(rows[0]) : null;
  }
  async getEvents(sessionId: string): Promise<readonly WorkflowEvent[]> {
    const rows = await this.request(`workflow_events?observation_session_id=eq.${encodeURIComponent(sessionId)}&select=*&order=occurred_at.asc`) as SupabaseRow[];
    return rows.map(mapEvent);
  }
  async getEvidence(projectId: string): Promise<readonly ExtractedEvidence[]> {
    const rows = await this.request(`evidence_extractions?select=*,evidence_artifacts!inner(project_id,status,scan_status)&evidence_artifacts.project_id=eq.${encodeURIComponent(projectId)}&evidence_artifacts.status=eq.ready&evidence_artifacts.scan_status=eq.clean&order=created_at.asc`) as SupabaseRow[];
    return rows.map(mapEvidence);
  }
  async nextWorkflowVersion(projectId: string): Promise<number> {
    const rows = await this.request(`workflow_versions?project_id=eq.${encodeURIComponent(projectId)}&select=version&order=version.desc&limit=1`) as SupabaseRow[];
    return rows[0] ? Number(rows[0].version) + 1 : 1;
  }
  async saveWorkflowVersion(value: { projectId: string; version: number; specification: WorkflowReconstruction; promptVersion: string; modelRole: string }): Promise<{ id: string; version: number }> {
    const rows = await this.request('workflow_versions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ project_id: value.projectId, version: value.version, status: 'draft', specification: value.specification, prompt_version: value.promptVersion, model_role: value.modelRole }]) }) as SupabaseRow[];
    return { id: String(rows[0].id), version: Number(rows[0].version) };
  }
  async saveRules(workflowVersionId: string, rules: WorkflowReconstruction['rules']): Promise<void> {
    await this.request('decision_rules', { method: 'POST', body: JSON.stringify(rules.map((rule) => ({ workflow_version_id: workflowVersionId, title: rule.name, condition: rule.condition, outcome: rule.action, boundary: rule.riskLevel === 'high' ? 'human_approval' : 'deterministic', status: rule.verificationStatus === 'confirmed' ? 'confirmed' : 'inferred', evidence_ids: rule.evidenceIds }))) });
  }
}
