import { createWorkflowRegistry } from '../../../lib/workflow-packs';
import { ApiError, authenticateRequest, canWrite, createProjectRequestSchema, enforceRateLimit, errorResponse, mapProject, organizationRoleFor, pilotProjectLimit, serviceRequest } from '../../../lib/platform/api';

export async function GET(request: Request) {
  try {
    const actor = await authenticateRequest(request); enforceRateLimit(actor.id, 'projects:list');
    const memberships = await serviceRequest<Array<{ organization_id: string }>>(`organization_memberships?user_id=eq.${encodeURIComponent(actor.id)}&select=organization_id`);
    const ids = memberships.map(({ organization_id }) => organization_id);
    if (!ids.length) return Response.json({ projects: [] });
    const projects = await serviceRequest<Record<string, unknown>[]>(`projects?organization_id=in.(${ids.map(encodeURIComponent).join(',')})&mode=eq.production&select=*&order=updated_at.desc`);
    return Response.json({ projects: projects.map(mapProject) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request); enforceRateLimit(actor.id, 'projects:create', 20);
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey || idempotencyKey.length < 8) return Response.json({ error: 'An Idempotency-Key header is required.' }, { status: 400 });
    const existing = await serviceRequest<Array<{ response_status: number; response_body: unknown }>>(`idempotency_keys?actor_id=eq.${encodeURIComponent(actor.id)}&endpoint=eq.projects.create&key=eq.${encodeURIComponent(idempotencyKey)}&select=response_status,response_body&limit=1`);
    if (existing[0]) return Response.json(existing[0].response_body, { status: existing[0].response_status });
    const input = createProjectRequestSchema.parse(await request.json());
    const role = await organizationRoleFor(actor.id, input.organizationId);
    if (!canWrite(role)) return Response.json({ error: 'You do not have permission to create projects in this organization.' }, { status: 403 });
    const activeProjects = await serviceRequest<Array<{ id: string }>>(`projects?organization_id=eq.${encodeURIComponent(input.organizationId)}&mode=eq.production&status=neq.archived&select=id`);
    if (activeProjects.length >= pilotProjectLimit()) throw new ApiError(429, 'This pilot organization has reached its active project limit. Archive a project or contact support.');
    createWorkflowRegistry().get(input.workflowType);
    const [row] = await serviceRequest<Record<string, unknown>[]>('projects', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ organization_id: input.organizationId, mode: 'production', created_by: actor.id, name: input.name, workflow_type: input.workflowType, status: 'draft' }]) });
    const project = mapProject(row); const responseBody = { project };
    await Promise.all([
      serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: input.organizationId, project_id: project.id, actor_id: actor.id, event_type: 'project.created', payload: { workflowType: project.workflowType } }]) }),
      serviceRequest('idempotency_keys', { method: 'POST', body: JSON.stringify([{ actor_id: actor.id, organization_id: input.organizationId, endpoint: 'projects.create', key: idempotencyKey, response_status: 201, response_body: responseBody }]) }),
    ]);
    return Response.json(responseBody, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
