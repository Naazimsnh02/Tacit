import type { EvidenceInsight, EvidenceRelationship, WorkflowChangeProposal, WorkflowReconstruction } from '@tacit/core-schemas';
import { serviceRequest } from '../platform/api';

type Row = Record<string, unknown>;
const text = (value: unknown) => String(value);

export type AiFirstWorkflowVersion = { readonly id: string; readonly projectId: string; readonly specification: WorkflowReconstruction; readonly version: number };

export async function latestWorkflowVersion(projectId: string): Promise<AiFirstWorkflowVersion | null> {
  const rows = await serviceRequest<Row[]>(`workflow_versions?project_id=eq.${encodeURIComponent(projectId)}&status=in.(draft,active)&specification=not.is.null&select=id,project_id,version,specification&order=version.desc&limit=1`);
  const row = rows[0]; return row ? { id: text(row.id), projectId: text(row.project_id), version: Number(row.version), specification: row.specification as WorkflowReconstruction } : null;
}
export async function workflowVersion(id: string): Promise<AiFirstWorkflowVersion | null> {
  const rows = await serviceRequest<Row[]>(`workflow_versions?id=eq.${encodeURIComponent(id)}&select=id,project_id,version,specification&limit=1`);
  const row = rows[0]; return row ? { id: text(row.id), projectId: text(row.project_id), version: Number(row.version), specification: row.specification as WorkflowReconstruction } : null;
}
export async function nextWorkflowVersion(projectId: string): Promise<number> { const current = await latestWorkflowVersion(projectId); return current ? current.version + 1 : 1; }

export async function projectEvidenceIds(projectId: string): Promise<Set<string>> {
  const rows = await serviceRequest<Row[]>(`evidence_extractions?select=id,evidence_artifacts!inner(project_id,status,scan_status)&evidence_artifacts.project_id=eq.${encodeURIComponent(projectId)}&evidence_artifacts.status=eq.ready&evidence_artifacts.scan_status=eq.clean`);
  return new Set(rows.map((row) => text(row.id)));
}

export async function listSourceIntelligence(projectId: string): Promise<{ insights: EvidenceInsight[]; relationships: EvidenceRelationship[]; jobs: Row[] }> {
  const [insights, relationships, jobs] = await Promise.all([
    serviceRequest<Row[]>(`evidence_insights?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=created_at.desc`),
    serviceRequest<Row[]>(`evidence_relationships?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=created_at.desc`),
    serviceRequest<Row[]>(`platform_jobs?project_id=eq.${encodeURIComponent(projectId)}&kind=in.(source_interpretation,cross_source_understanding)&select=id,kind,status,error_message,created_at,completed_at&order=created_at.desc`),
  ]);
  return { insights: insights.map(insight), relationships: relationships.map(relationship), jobs };
}

export async function enqueueUnderstandingJobs(projectId: string, actorId: string): Promise<'queued' | 'already_processed'> {
  const evidenceIds = [...await projectEvidenceIds(projectId)].sort();
  if (!evidenceIds.length) throw new AiFirstRepositoryError('Add at least one clean, processed source before starting source intelligence.');
  const key = evidenceIds.join(':');
  const existing = await serviceRequest<Row[]>(`platform_jobs?project_id=eq.${encodeURIComponent(projectId)}&kind=eq.cross_source_understanding&idempotency_key=eq.${encodeURIComponent(key)}&select=id&limit=1`);
  if (existing.length) return 'already_processed';
  await serviceRequest('platform_jobs', { method: 'POST', body: JSON.stringify([
    { project_id: projectId, kind: 'source_interpretation', payload: { evidenceIds, requestedBy: actorId }, idempotency_key: `source:${key}` },
    { project_id: projectId, kind: 'cross_source_understanding', payload: { evidenceIds, requestedBy: actorId }, idempotency_key: key },
  ]) });
  return 'queued';
}

export async function createProposal(input: { projectId: string; workflowVersionId: string; requestedChange: string; patch: unknown; affectedRuleIds: string[]; impact: Record<string, unknown>; riskLevel: 'low' | 'medium' | 'high'; actorId: string }): Promise<WorkflowChangeProposal> {
  const rows = await serviceRequest<Row[]>('workflow_change_proposals', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ project_id: input.projectId, workflow_version_id: input.workflowVersionId, requested_change: input.requestedChange, patch: input.patch, affected_rule_ids: input.affectedRuleIds, impact: input.impact, risk_level: input.riskLevel, proposed_by: input.actorId }]) });
  return proposal(rows[0] ?? {});
}
export async function getProposal(id: string): Promise<WorkflowChangeProposal | null> { const rows = await serviceRequest<Row[]>(`workflow_change_proposals?id=eq.${encodeURIComponent(id)}&select=*&limit=1`); return rows[0] ? proposal(rows[0]) : null; }
export async function resolveProposal(id: string, status: 'accepted' | 'rejected', resultingWorkflowVersionId: string | null = null): Promise<void> { await serviceRequest(`workflow_change_proposals?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, resulting_workflow_version_id: resultingWorkflowVersionId, decided_at: new Date().toISOString() }) }); }
export async function saveWorkflowVersion(input: { projectId: string; version: number; specification: WorkflowReconstruction; actorId: string }): Promise<AiFirstWorkflowVersion> {
  const rows = await serviceRequest<Row[]>('workflow_versions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ project_id: input.projectId, version: input.version, status: 'draft', specification: input.specification, prompt_version: 'conversation-change-v1', model_role: 'workflow_conversation', created_by: input.actorId }]) });
  const row = rows[0] ?? {}; return { id: text(row.id), projectId: text(row.project_id), version: Number(row.version), specification: row.specification as WorkflowReconstruction };
}
export async function markBuildsStale(workflowVersionId: string): Promise<void> { await serviceRequest(`agent_builds?workflow_version_id=eq.${encodeURIComponent(workflowVersionId)}&status=in.(queued,running,succeeded)`, { method: 'PATCH', body: JSON.stringify({ status: 'stale' }) }); }
export async function countOpenClarifications(workflowVersionId: string): Promise<number> { const rows = await serviceRequest<Row[]>(`clarification_questions?workflow_version_id=eq.${encodeURIComponent(workflowVersionId)}&status=eq.open&select=id`); return rows.length; }
export async function latestReplayAccuracy(projectId: string): Promise<number | null> { const rows = await serviceRequest<Row[]>(`impact_snapshots?project_id=eq.${encodeURIComponent(projectId)}&select=accuracy_percent&order=captured_at.desc&limit=1`); return rows[0] ? Number(rows[0].accuracy_percent) / 100 : null; }
export async function saveReadiness(input: { projectId: string; workflowVersionId: string; recommendedMode: string; reasons: string[]; metrics: Record<string, unknown>; actorId: string }): Promise<void> { await serviceRequest('agent_readiness_reviews', { method: 'POST', body: JSON.stringify([{ project_id: input.projectId, workflow_version_id: input.workflowVersionId, recommended_mode: input.recommendedMode, reasons: input.reasons, metrics: input.metrics, reviewed_by: input.actorId }]) }); }
export async function addOperatingObservation(input: { projectId: string; workflowVersionId: string | null; kind: string; payload: Record<string, unknown>; evidenceIds: string[]; actorId: string }): Promise<void> { await serviceRequest('operating_observations', { method: 'POST', body: JSON.stringify([{ project_id: input.projectId, workflow_version_id: input.workflowVersionId, kind: input.kind, payload: input.payload, evidence_ids: input.evidenceIds, submitted_by: input.actorId }]) }); }

export class AiFirstRepositoryError extends Error {}
function insight(row: Row): EvidenceInsight { return { id: text(row.id), projectId: text(row.project_id), artifactId: row.artifact_id === null ? null : text(row.artifact_id), kind: row.kind as EvidenceInsight['kind'], content: text(row.content), entityType: row.entity_type === null ? null : text(row.entity_type), entityValue: row.entity_value === null ? null : text(row.entity_value), confidence: Number(row.confidence), extractionIds: Array.isArray(row.extraction_ids) ? row.extraction_ids.map(text) : [], modelRole: text(row.model_role), modelVersion: text(row.model_version), createdAt: text(row.created_at) }; }
function relationship(row: Row): EvidenceRelationship { return { id: text(row.id), projectId: text(row.project_id), fromInsightId: text(row.from_insight_id), toInsightId: text(row.to_insight_id), type: row.relationship_type as EvidenceRelationship['type'], rationale: text(row.rationale), extractionIds: Array.isArray(row.extraction_ids) ? row.extraction_ids.map(text) : [], confidence: Number(row.confidence), createdAt: text(row.created_at) }; }
function proposal(row: Row): WorkflowChangeProposal { return { id: text(row.id), projectId: text(row.project_id), workflowVersionId: text(row.workflow_version_id), requestedChange: text(row.requested_change), patch: Array.isArray(row.patch) ? row.patch as WorkflowChangeProposal['patch'] : [], affectedRuleIds: Array.isArray(row.affected_rule_ids) ? row.affected_rule_ids.map(text) : [], impact: (row.impact ?? {}) as Record<string, unknown>, riskLevel: row.risk_level as WorkflowChangeProposal['riskLevel'], status: row.status as WorkflowChangeProposal['status'], proposedBy: row.proposed_by === null ? null : text(row.proposed_by), resultingWorkflowVersionId: row.resulting_workflow_version_id === null ? null : text(row.resulting_workflow_version_id), createdAt: text(row.created_at), decidedAt: row.decided_at === null ? null : text(row.decided_at) }; }
