import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const projectId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const evidenceId = '44444444-4444-4444-8444-444444444444';

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

describe('observation session API', () => {
  it('upserts a saved observation so reconstruction can be retried safely', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ organization_id: organizationId, mode: 'demo' }])))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    globalThis.fetch = fetchMock;

    const timestamp = '2026-07-18T12:00:00.000Z';
    const response = await POST(new Request(`http://localhost/api/projects/${projectId}/sessions`, {
      method: 'POST', body: JSON.stringify({
        session: { id: sessionId, projectId, status: 'completed', startedAt: timestamp, completedAt: timestamp, narration: 'Review evidence.', createdAt: timestamp },
        events: [{ id: '55555555-5555-4555-8555-555555555555', observationSessionId: sessionId, source: 'user', action: 'complete_review', occurredAt: timestamp, payload: {}, evidenceIds: [evidenceId] }],
      }),
    }), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(201);
    for (const [, init] of fetchMock.mock.calls.slice(1)) {
      expect(new Headers(init.headers).get('Prefer')).toBe('resolution=merge-duplicates');
    }
  });
});
