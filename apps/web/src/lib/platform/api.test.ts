import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectRequestSchema, mapProject, pilotProjectLimit, serviceRequest, slugifyOrganizationName, updateProjectRequestSchema } from './api';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
});

describe('production project API contracts', () => {
  it('accepts only generic project creation fields', () => {
    expect(createProjectRequestSchema.safeParse({ organizationId: '11111111-1111-4111-8111-111111111111', name: 'Claims review', workflowType: 'customer_support_escalation' }).success).toBe(true);
    expect(createProjectRequestSchema.safeParse({ organizationId: '11111111-1111-4111-8111-111111111111', name: '', workflowType: 'invoice-exception' }).success).toBe(false);
  });

  it('does not permit an empty project update', () => {
    expect(updateProjectRequestSchema.safeParse({}).success).toBe(false);
  });

  it('maps tenant ownership and mode from persistence rows', () => {
    expect(mapProject({ id: '11111111-1111-4111-8111-111111111111', organization_id: '22222222-2222-4222-8222-222222222222', mode: 'production', created_by: '33333333-3333-4333-8333-333333333333', name: 'Claims', workflow_type: 'customer_support_escalation', status: 'draft', configuration: {}, created_at: '2026-07-16T09:00:00.000Z', updated_at: '2026-07-16T09:00:00.000Z' })).toMatchObject({ organizationId: '22222222-2222-4222-8222-222222222222', mode: 'production' });
  });

  it('creates URL-safe organization slugs without retaining the original casing', () => {
    expect(slugifyOrganizationName('Northwind & Co.')).toMatch(/^northwind-co-[a-f0-9]{8}$/);
  });
  it('keeps the pilot active-project limit bounded even with an invalid environment value', () => {
    expect(pilotProjectLimit('8')).toBe(8);
    expect(pilotProjectLimit('0')).toBe(5);
    expect(pilotProjectLimit('unbounded')).toBe(5);
  });

  it('accepts successful Supabase writes with an empty response body', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await expect(serviceRequest('organization_memberships', { method: 'POST', body: '[]' })).resolves.toBeUndefined();
  });
});
