import { NextResponse } from 'next/server';
import { createWorkflowGraph } from '../../../../../lib/workflow-graph/model';
import { SupabaseWorkflowGraphRepository } from '../../../../../lib/workflow-graph/repository';
import { authorizeProjectRequest, errorResponse, serviceRequest } from '../../../../../lib/platform/api';

export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await context.params;
    const rows = await serviceRequest<Array<{ project_id: string }>>(`workflow_versions?id=eq.${encodeURIComponent(versionId)}&select=project_id&limit=1`);
    if (rows[0]) await authorizeProjectRequest(request, rows[0].project_id);
    const reconstruction = await new SupabaseWorkflowGraphRepository().getReconstruction(versionId);
    if (!reconstruction) return NextResponse.json({ error: 'Workflow version not found.' }, { status: 404 });
    const graph = createWorkflowGraph(reconstruction);
    const evidenceRows = await serviceRequest<Array<{ id: string; page_start: number | null; page_end: number | null; time_start_ms: number | null; time_end_ms: number | null; evidence_artifacts: { display_name: string } | null }>>(`evidence_extractions?select=id,page_start,page_end,time_start_ms,time_end_ms,evidence_artifacts!inner(project_id,display_name)&evidence_artifacts.project_id=eq.${encodeURIComponent(rows[0]?.project_id ?? '')}`);
    const labels = new Map(evidenceRows.map((row) => [row.id, `${row.evidence_artifacts?.display_name ?? 'Source'} · ${citation(row)}`]));
    return NextResponse.json({ ...graph, nodes: graph.nodes.map((node) => ({ ...node, detail: { ...node.detail, evidence: node.detail.evidenceIds.map((id) => ({ id, label: labels.get(id) ?? 'Unavailable source segment' })) } })) });
  } catch (error) {
    return errorResponse(error);
  }
}

function citation(row: { page_start: number | null; page_end: number | null; time_start_ms: number | null; time_end_ms: number | null }) {
  if (row.page_start) return `p. ${row.page_start}${row.page_end && row.page_end !== row.page_start ? `-${row.page_end}` : ''}`;
  if (row.time_start_ms !== null) return `${Math.floor(row.time_start_ms / 60_000)}:${String(Math.floor(row.time_start_ms / 1_000) % 60).padStart(2, '0')}`;
  return 'source-wide';
}
