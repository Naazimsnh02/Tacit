import { z } from 'zod';

export const workflowTypeSchema = z.string().min(1).regex(/^[a-z0-9-]+$/);
export type WorkflowType = z.infer<typeof workflowTypeSchema>;
