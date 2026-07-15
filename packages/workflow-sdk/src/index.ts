import {
  documentEvidenceSchema,
  projectSchema,
  testCaseSchema,
  type DocumentEvidence,
  type Project,
  type TestCase,
  type WorkflowType,
} from '@tacit/core-schemas';
import { z } from 'zod';

export interface WorkflowPackSeed {
  readonly project: Project;
  readonly documents: readonly DocumentEvidence[];
  readonly testCases: readonly TestCase[];
  readonly domainRecords: readonly { id: string; type: string; schemaVersion: string; payload?: unknown }[];
}

export const workflowPackSeedSchema = z.object({
  project: projectSchema,
  documents: z.array(documentEvidenceSchema),
  testCases: z.array(testCaseSchema),
  domainRecords: z.array(z.object({
    id: z.string().min(1), type: z.string().min(1), schemaVersion: z.string().min(1), payload: z.unknown(),
  })),
});

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
  readonly seedLoader: () => WorkflowPackSeed;
}

export function defineWorkflowPack<Input extends z.ZodType, Outcome extends z.ZodType>(
  workflowPack: WorkflowPack<Input, Outcome>,
): WorkflowPack<Input, Outcome> {
  return workflowPack;
}
