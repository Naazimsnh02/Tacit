import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateWithPassword } from './auth';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('password authentication', () => {
  it('posts new users to Supabase signup and handles email confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { email: 'new@tacit.test' } }), { status: 200 }));
    globalThis.fetch = fetchMock;

    await expect(authenticateWithPassword({ url: 'https://example.supabase.co/', anonKey: 'anon-key', mode: 'sign_up', email: 'new@tacit.test', password: 'password' })).resolves.toEqual({ session: null });
    expect(fetchMock).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/signup', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'new@tacit.test', password: 'password' }) }));
  });

  it('returns a session when signup does not require email confirmation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'token', user: { email: 'new@tacit.test' } }), { status: 200 }));

    await expect(authenticateWithPassword({ url: 'https://example.supabase.co', anonKey: 'anon-key', mode: 'sign_up', email: 'new@tacit.test', password: 'password' })).resolves.toEqual({ session: { accessToken: 'token', email: 'new@tacit.test' } });
  });
});
