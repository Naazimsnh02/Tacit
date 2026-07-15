import { describe, expect, it } from 'vitest';
import { getServerEnvironment } from './env';

const validEnvironment = {
  OPENAI_API_KEY: 'key', OPENAI_REASONING_MODEL: 'reasoning', OPENAI_DEFAULT_MODEL: 'default', OPENAI_FAST_MODEL: 'fast',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
  AGENT_RUNTIME_URL: 'http://localhost:8000', AGENT_EXECUTION_TIMEOUT_SECONDS: '10',
};

describe('getServerEnvironment', () => {
  it('returns validated server environment values', () => {
    expect(getServerEnvironment(validEnvironment).AGENT_EXECUTION_TIMEOUT_SECONDS).toBe(10);
  });

  it('rejects missing required values', () => {
    expect(() => getServerEnvironment({ ...validEnvironment, OPENAI_API_KEY: '' })).toThrow();
  });
});
