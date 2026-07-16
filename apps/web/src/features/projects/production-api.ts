'use client';

const sessionKey = 'tacit.production.session';

export function productionAccessToken(): string | null {
  try {
    return (JSON.parse(window.sessionStorage.getItem(sessionKey) ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null;
  } catch {
    return null;
  }
}

/** Adds the production bearer token when present without breaking the isolated demo flow. */
export function productionHeaders(init: HeadersInit = {}): Headers {
  const headers = new Headers(init);
  const token = productionAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}
