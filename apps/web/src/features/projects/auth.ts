export type PasswordAuthMode = 'sign_in' | 'sign_up';

export interface PasswordSession {
  readonly accessToken: string;
  readonly email: string | null;
}

interface SupabaseAuthResponse {
  readonly access_token?: string;
  readonly user?: { readonly email?: string };
  readonly error_description?: string;
  readonly msg?: string;
  readonly message?: string;
  readonly error?: string;
}

function responseError(body: SupabaseAuthResponse, fallback: string): string {
  return body.error_description ?? body.msg ?? body.message ?? body.error ?? fallback;
}

export async function authenticateWithPassword({
  url,
  anonKey,
  mode,
  email,
  password,
}: {
  readonly url: string;
  readonly anonKey: string;
  readonly mode: PasswordAuthMode;
  readonly email: string;
  readonly password: string;
}): Promise<{ readonly session: PasswordSession | null }> {
  const endpoint = mode === 'sign_in' ? '/auth/v1/token?grant_type=password' : '/auth/v1/signup';
  const response = await fetch(`${url.replace(/\/$/, '')}${endpoint}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json() as SupabaseAuthResponse;
  if (!response.ok) throw new Error(responseError(body, mode === 'sign_in' ? 'Unable to sign in.' : 'Unable to create your account.'));
  if (mode === 'sign_in' && !body.access_token) throw new Error('Unable to sign in.');

  return {
    session: body.access_token
      ? { accessToken: body.access_token, email: body.user?.email ?? email }
      : null,
  };
}
