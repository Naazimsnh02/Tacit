import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const projectId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const workflowVersionId = '33333333-3333-4333-8333-333333333333';
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

describe('production observation API', () => {
  it('returns the latest confirmed workflow version for valid downstream navigation', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: '44444444-4444-4444-8444-444444444444' })))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: projectId, organization_id: organizationId, mode: 'production', created_by: null, name: 'Invoice review', workflow_type: 'invoice_exception', status: 'active', configuration: {}, created_at: '2026-07-18T00:00:00.000Z', updated_at: '2026-07-18T00:00:00.000Z' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ role: 'owner' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ workflow_version_id: workflowVersionId, created_at: '2026-07-18T00:00:00.000Z' }])));

    const response = await GET(new Request(`http://localhost/api/projects/${projectId}/observation`, { headers: { Authorization: 'Bearer token' } }), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(200);
    expect((await response.json()).workflow.confirmedVersionId).toBe(workflowVersionId);
  });
});
