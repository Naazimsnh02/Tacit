import { authenticateRequest, createOrganizationRequestSchema, enforceRateLimit, errorResponse, serviceRequest, slugifyOrganizationName } from '../../../lib/platform/api';

export async function GET(request: Request) {
  try {
    const actor = await authenticateRequest(request); enforceRateLimit(actor.id, 'organizations:list');
    const memberships = await serviceRequest<Array<{ role: string; organizations: { id: string; name: string; slug: string; mode: 'production' | 'demo' } | null }>>(`organization_memberships?user_id=eq.${encodeURIComponent(actor.id)}&select=role,organizations(id,name,slug,mode)&order=created_at.asc`);
    return Response.json({ organizations: memberships.flatMap(({ role, organizations }) => organizations?.mode === 'production' ? [{ ...organizations, role }] : []) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request); enforceRateLimit(actor.id, 'organizations:create', 10);
    const input = createOrganizationRequestSchema.parse(await request.json());
    const [organization] = await serviceRequest<Array<{ id: string; name: string; slug: string; mode: 'production' }>>('organizations', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ name: input.name, slug: slugifyOrganizationName(input.name), mode: 'production', created_by: actor.id }]) });
    await serviceRequest('organization_memberships', { method: 'POST', body: JSON.stringify([{ organization_id: organization.id, user_id: actor.id, role: 'owner' }]) });
    await serviceRequest('audit_events', { method: 'POST', body: JSON.stringify([{ organization_id: organization.id, actor_id: actor.id, event_type: 'organization.created', payload: { name: organization.name } }]) });
    return Response.json({ organization: { ...organization, role: 'owner' } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
