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

/**
 * Serializable presentation metadata. The observation shell interprets this
 * configuration; workflow packs own the actual labels and domain values.
 */
export interface WorkspaceFieldDefinition {
  readonly id: string;
  readonly label: string;
}

export interface WorkspacePanelDefinition {
  readonly id: string;
  readonly label: string;
  readonly kind: 'document' | 'reference' | 'controls';
  readonly fields: readonly WorkspaceFieldDefinition[];
}

export interface WorkspaceActionDefinition {
  readonly id: string;
  readonly label: string;
  readonly eventAction: string;
  readonly evidenceTypes: readonly string[];
}

export interface WorkspaceDefinition {
  readonly panels: readonly WorkspacePanelDefinition[];
  readonly actions: readonly WorkspaceActionDefinition[];
  readonly outcomes: readonly { id: string; label: string }[];
}

export interface WorkspacePanelData {
  readonly panelId: string;
  readonly values: Readonly<Record<string, string | number | boolean | null>>;
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
  readonly workspaceDefinition: WorkspaceDefinition;
  readonly eventCatalog: readonly string[];
  readonly evidenceTypes: readonly string[];
  readonly supportedActions: readonly WorkspaceActionDefinition[];
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
