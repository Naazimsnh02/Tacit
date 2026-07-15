import type { WorkflowType } from '@tacit/core-schemas';
import type { z } from 'zod';

export interface WorkflowPack<Input extends z.ZodType, Outcome extends z.ZodType> {
  readonly id: WorkflowType;
  readonly name: string;
  readonly version: string;
  readonly inputSchema: Input;
  readonly outcomeSchema: Outcome;
  readonly workspaceDefinition: readonly { id: string; label: string }[];
  readonly eventCatalog: readonly string[];
  readonly evidenceTypes: readonly string[];
  readonly supportedActions: readonly string[];
  readonly approvalPolicy: unknown;
  readonly evaluationDefinition: unknown;
  readonly promptContext: string;
}

export function defineWorkflowPack<Input extends z.ZodType, Outcome extends z.ZodType>(
  workflowPack: WorkflowPack<Input, Outcome>,
): WorkflowPack<Input, Outcome> {
  return workflowPack;
}
