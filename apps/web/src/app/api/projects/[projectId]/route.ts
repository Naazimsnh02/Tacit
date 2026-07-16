import { z } from 'zod';
import { authenticateRequest, canWrite, enforceRateLimit, errorResponse, mapProject, organizationRoleFor, serviceRequest, updateProjectRequestSchema } from '../../../../lib/platform/api';

const projectIdSchema = z.string().uuid();

async function projectForActor(actorId: string, projectId: string) {
  const rows = await serviceRequest<Record<string, unknown>[]>(`projects?id=eq.${encodeURIComponent(projectId)}&mode=eq.production&select=*&limit=1`);
  const row = rows[0]; if (!row) return null;
  const project = mapProject(row); const role = await organizationRoleFor(actorId, project.organizationId);
  return role ? { project, role } : null;
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const actor = await authenticateRequest(request); enforceRateLimit(actor.id, 'projects:read');
    const { projectId } = await context.params; const found = await projectForActor(actor.id, projectIdSchema.parse(projectId));
    return found ? Response.json({ project: found.project, role: found.role }) : Response.json({ error: 'Project not found.' }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const actor = await authenticateRequest(request); enforceRateLimit(actor.id, 'projects:update');
    const { projectId } = await context.params; const found = await projectForActor(actor.id, projectIdSchema.parse(projectId));
    if (!found) return Response.json({ error: 'Project not found.' }, { status: 404 });
    if (!canWrite(found.role)) return Response.json({ error: 'You do not have permission to update this project.' }, { status: 403 });
    const input = updateProjectRequestSchema.parse(await request.json());
    const [row] = await serviceRequest<Record<string, unknown>[]>(`projects?id=eq.${encodeURIComponent(found.project.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...(input.name ? { name: input.name } : {}), ...(input.status ? { status: input.status } : {}), updated_at: new Date().toISOString() }) });
    const project = mapProject(row);
    await serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: project.organizationId, project_id: project.id, actor_id: actor.id, event_type: 'project.updated', payload: input }]) });
    return Response.json({ project });
  } catch (error) { return errorResponse(error); }
}
