import { z } from 'zod';

const serverEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_REASONING_MODEL: z.string().min(1),
  OPENAI_DEFAULT_MODEL: z.string().min(1),
  OPENAI_FAST_MODEL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AGENT_RUNTIME_URL: z.string().url(),
  AGENT_EXECUTION_TIMEOUT_SECONDS: z.coerce.number().int().positive(),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(
  environment: Record<string, unknown> = process.env,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
