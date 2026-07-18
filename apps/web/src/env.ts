import { z } from 'zod';

const serverEnvironmentSchema = z.object({
  LLM_BACKEND: z.enum(['openai_api', 'codex_subscription']).default('openai_api'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_REASONING_MODEL: z.string().min(1).optional(),
  OPENAI_DEFAULT_MODEL: z.string().min(1).optional(),
  OPENAI_FAST_MODEL: z.string().min(1).optional(),
  OPENAI_CODEX_MODEL: z.string().min(1).optional(),
  CODEX_SUBSCRIPTION_RUNNER_URL: z.string().url().optional(),
  CODEX_SUBSCRIPTION_RUNNER_SECRET: z.string().min(32).optional(),
  CODEX_SUBSCRIPTION_MODEL: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AGENT_RUNTIME_URL: z.string().url(),
  AGENT_EXECUTION_TIMEOUT_SECONDS: z.coerce.number().int().positive(),
}).superRefine((value, context) => {
  const required = value.LLM_BACKEND === 'codex_subscription'
    ? ['CODEX_SUBSCRIPTION_RUNNER_URL', 'CODEX_SUBSCRIPTION_RUNNER_SECRET', 'CODEX_SUBSCRIPTION_MODEL'] as const
    : ['OPENAI_API_KEY', 'OPENAI_REASONING_MODEL', 'OPENAI_DEFAULT_MODEL', 'OPENAI_FAST_MODEL', 'OPENAI_CODEX_MODEL'] as const;
  for (const key of required) {
    if (!value[key]) context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required for ${value.LLM_BACKEND}.` });
  }
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(
  environment: Record<string, unknown> = process.env,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
