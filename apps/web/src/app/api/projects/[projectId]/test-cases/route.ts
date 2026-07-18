import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authorizeProjectRequest, enforceRateLimit, errorResponse, ApiError, serviceRequest } from '../../../../../lib/platform/api';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';

const importedCaseSchema = z.object({
  label: z.string().trim().min(1).max(240), input: z.record(z.unknown()), expectedOutcome: z.record(z.unknown()),
  evidenceFiles: z.array(z.string().trim().min(1).max(255)).min(1).max(20),
});
const importSchema = z.object({ cases: z.array(importedCaseSchema).min(1).max(100) });
type Row = Record<string, unknown>;

function normalized(value: string) { return value.trim().toLocaleLowerCase(); }

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    await authorizeProjectRequest(request, projectId);
    const rows = await serviceRequest<Row[]>(`test_cases?project_id=eq.${encodeURIComponent(projectId)}&select=id,label,created_at&order=created_at.asc`);
    return Response.json({ count: rows.length, cases: rows.map((row) => ({ id: String(row.id), label: String(row.label), createdAt: String(row.created_at) })) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, access, body] = await Promise.all([context.params, context.params.then(({ projectId: id }) => authorizeProjectRequest(request, id, true)), request.json()]);
    if (access.mode !== 'production' || !access.actor) throw new ApiError(403, 'Historical cases can be imported only into a production project.');
    enforceRateLimit(access.actor.id, 'evaluations:import', 10);
    const payload = importSchema.parse(body);
    const projectRows = await serviceRequest<Row[]>(`projects?id=eq.${encodeURIComponent(projectId)}&mode=eq.production&select=workflow_type&limit=1`);
    const project = projectRows[0]; if (!project) throw new ApiError(404, 'Production project not found.');
    const pack = createWorkflowRegistry().get(String(project.workflow_type));
    const existing = await serviceRequest<Row[]>(`test_cases?project_id=eq.${encodeURIComponent(projectId)}&select=label`);
    const labels = new Set(existing.map((row) => normalized(String(row.label))));
    const extractionRows = await serviceRequest<Row[]>(`evidence_extractions?select=id,evidence_artifacts!inner(project_id,filename,display_name,status,scan_status)&evidence_artifacts.project_id=eq.${encodeURIComponent(projectId)}&evidence_artifacts.status=eq.ready&evidence_artifacts.scan_status=eq.clean`);
    const sourceToExtractionIds = new Map<string, string[]>();
    for (const extraction of extractionRows) {
      const artifact = extraction.evidence_artifacts as Row;
      for (const name of [artifact.filename, artifact.display_name]) {
        const key = normalized(String(name)); const ids = sourceToExtractionIds.get(key) ?? [];
        ids.push(String(extraction.id)); sourceToExtractionIds.set(key, ids);
      }
    }
    const cases = payload.cases.map((item, index) => {
      if (labels.has(normalized(item.label))) throw new ApiError(409, `A historical case named “${item.label}” already exists.`);
      labels.add(normalized(item.label));
      const input = pack.inputSchema.safeParse(item.input); if (!input.success) throw new ApiError(400, `Case ${index + 1} has an invalid ${pack.name} input.`);
      const expectedOutcome = pack.outcomeSchema.safeParse(item.expectedOutcome); if (!expectedOutcome.success) throw new ApiError(400, `Case ${index + 1} has an invalid expected outcome.`);
      const evidenceIds = [...new Set(item.evidenceFiles.flatMap((name) => sourceToExtractionIds.get(normalized(name)) ?? []))];
      if (evidenceIds.length === 0) throw new ApiError(400, `Case ${index + 1} does not reference a ready project evidence file.`);
      return { id: randomUUID(), project_id: projectId, label: item.label, input: input.data, expected_outcome: expectedOutcome.data, evidence_ids: evidenceIds };
    });
    await serviceRequest('test_cases', { method: 'POST', body: JSON.stringify(cases) });
    await serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: access.organizationId, project_id: projectId, actor_id: access.actor.id, event_type: 'evaluation.historical_cases_imported', payload: { count: cases.length, labels: cases.map((item) => item.label) } }]) });
    return Response.json({ imported: cases.length }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
