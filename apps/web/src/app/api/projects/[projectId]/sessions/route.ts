import { z } from 'zod';
import { observationSessionSchema, workflowEventSchema } from '@tacit/core-schemas';
import { ObservationPersistenceError, persistCompletedObservation } from '../../../../../lib/observation/service';
import { SupabaseObservationRepository } from '../../../../../lib/observation/supabase-repository';
import { authenticateRequest, canWrite, errorResponse, organizationRoleFor, serviceRequest, ApiError } from '../../../../../lib/platform/api';

const requestSchema = z.object({ session: observationSessionSchema, events: z.array(workflowEventSchema).min(1) });
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const [{ projectId }, body] = await Promise.all([context.params, request.json()]); const payload = requestSchema.parse(body);
    const projects = await serviceRequest<Array<{ organization_id: string; mode: string }>>(`projects?id=eq.${encodeURIComponent(projectId)}&select=organization_id,mode&limit=1`);
    const project = projects[0]; if (!project) throw new ApiError(404, 'Project not found.');
    if (project.mode === 'production') {
      const actor = await authenticateRequest(request);
      if (!canWrite(await organizationRoleFor(actor.id, project.organization_id))) throw new ApiError(403, 'You do not have permission to record this observation.');
      const evidenceIds = [...new Set(payload.events.flatMap((event) => event.evidenceIds))];
      if (!evidenceIds.length) throw new ObservationPersistenceError('Link extracted evidence before completing a production observation.');
      const rows = await serviceRequest<Array<{ id: string }>>(`evidence_extractions?select=id,evidence_artifacts!inner(project_id,status,scan_status)&id=in.(${evidenceIds.map(encodeURIComponent).join(',')})&evidence_artifacts.project_id=eq.${encodeURIComponent(projectId)}&evidence_artifacts.status=eq.ready&evidence_artifacts.scan_status=eq.clean`);
      if (rows.length !== evidenceIds.length) throw new ObservationPersistenceError('Every observation citation must be a clean extracted evidence segment from this project.');
    }
    await persistCompletedObservation({ projectId, session: payload.session, events: payload.events, repository: new SupabaseObservationRepository() });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { if (error instanceof ApiError) return errorResponse(error); const message = error instanceof Error ? error.message : 'Unable to save the observation.'; return Response.json({ error: message }, { status: error instanceof z.ZodError || error instanceof ObservationPersistenceError ? 400 : 500 }); }
}
