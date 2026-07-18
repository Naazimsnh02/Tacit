import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { OrganizationRole, ProductMode, Project } from '@tacit/core-schemas';

const supabaseUrlSchema = z.string().url();

export const createOrganizationRequestSchema = z.object({ name: z.string().trim().min(1).max(160) });
export const createProjectRequestSchema = z.object({
  organizationId: z.string().uuid(), name: z.string().trim().min(1).max(160), workflowType: z.string().regex(/^[a-z][a-z0-9_]*$/),
});
export const updateProjectRequestSchema = z.object({ name: z.string().trim().min(1).max(160), status: z.enum(['draft', 'active', 'archived']).optional() }).refine((value) => Object.keys(value).length > 0);

export interface AuthenticatedActor { readonly id: string; readonly email: string | null; readonly token: string; }
export interface OrganizationRecord { readonly id: string; readonly name: string; readonly slug: string; readonly mode: ProductMode; readonly role: OrganizationRole; }
export interface ProjectRequestAccess {
  readonly projectId: string;
  readonly organizationId: string;
  readonly mode: ProductMode;
  readonly actor: AuthenticatedActor | null;
  readonly role: OrganizationRole | null;
}

export function slugifyOrganizationName(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'organization';
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id), organizationId: String(row.organization_id), mode: row.mode as ProductMode,
    createdBy: row.created_by === null ? null : String(row.created_by), name: String(row.name), workflowType: String(row.workflow_type),
    status: row.status as Project['status'], configuration: (row.configuration ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function publicSupabaseConfig() {
  const url = supabaseUrlSchema.safeParse(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url.success || !key) throw new Error('Authentication is not configured.');
  return { url: url.data.replace(/\/$/, ''), key };
}

export function serviceSupabaseConfig() {
  const { url } = publicSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Server persistence is not configured.');
  return { url, key };
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedActor> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'Sign in is required.');
  const token = authorization.slice('Bearer '.length);
  const config = publicSupabaseConfig();
  const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.key, Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new ApiError(401, 'Your session is invalid or expired.');
  const user = await response.json() as { id?: unknown; email?: unknown };
  if (typeof user.id !== 'string') throw new ApiError(401, 'Your session is invalid or expired.');
  return { id: user.id, email: typeof user.email === 'string' ? user.email : null, token };
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function serviceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = serviceSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  if (!response.ok) throw new ApiError(500, 'The request could not be completed.');
  const body = await response.text();
  return body ? JSON.parse(body) as T : undefined as T;
}

export async function organizationRoleFor(actorId: string, organizationId: string): Promise<OrganizationRole | null> {
  const rows = await serviceRequest<Array<{ role: OrganizationRole }>>(`organization_memberships?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(actorId)}&select=role&limit=1`);
  return rows[0]?.role ?? null;
}

export function canWrite(role: OrganizationRole | null): boolean { return role === 'owner' || role === 'admin' || role === 'member'; }

/**
 * Service-role repositories bypass database RLS. Production API routes must call
 * this before reading or mutating a tenant-owned record through those repositories.
 * Demo records remain reachable only through their explicit demo path.
 */
export async function authorizeProjectRequest(request: Request, projectId: string, write = false): Promise<ProjectRequestAccess> {
  const rows = await serviceRequest<Array<{ id: string; organization_id: string; mode: ProductMode }>>(`projects?id=eq.${encodeURIComponent(projectId)}&select=id,organization_id,mode&limit=1`);
  const project = rows[0];
  if (!project) throw new ApiError(404, 'Project not found.');
  if (project.mode === 'demo') return { projectId: project.id, organizationId: project.organization_id, mode: 'demo', actor: null, role: null };
  const actor = await authenticateRequest(request);
  const role = await organizationRoleFor(actor.id, project.organization_id);
  if (!role) throw new ApiError(403, 'You do not have access to this project.');
  if (write && !canWrite(role)) throw new ApiError(403, 'You do not have permission to change this project.');
  return { projectId: project.id, organizationId: project.organization_id, mode: 'production', actor, role };
}

export function pilotProjectLimit(rawValue = process.env.PILOT_MAX_ACTIVE_PROJECTS_PER_ORGANIZATION): number {
  if (!rawValue) return 5;
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 100 ? parsed : 5;
}

const windows = new Map<string, { count: number; resetAt: number }>();
export function enforceRateLimit(actorId: string, endpoint: string, limit = 30, windowMs = 60_000): void {
  const key = `${actorId}:${endpoint}`; const now = Date.now(); const existing = windows.get(key);
  const entry = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
  entry.count += 1; windows.set(key, entry);
  if (entry.count > limit) throw new ApiError(429, 'Too many requests. Please try again shortly.');
}

export function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) return Response.json({ error: 'Invalid request.', details: error.flatten() }, { status: 400 });
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: 'The request could not be completed.' }, { status: 500 });
}
