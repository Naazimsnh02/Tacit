import {
  documentEvidenceSchema,
  projectSchema,
  testCaseSchema,
  type DocumentEvidence,
  type Project,
  type TestCase,
  type WorkflowType,
  type ClarificationAnswerValue,
  type ClarificationQuestionDraft,
  type WorkflowReconstruction,
  type WorkflowSpecification,
  type EvaluationMatchCategory,
  type ApprovalRequest,
  type ImpactMetrics,
} from '@tacit/core-schemas';
import { z } from 'zod';

export interface WorkflowPackSeed {
  readonly project: Project;
  readonly documents: readonly DocumentEvidence[];
  readonly testCases: readonly TestCase[];
  readonly domainRecords: readonly { id: string; type: string; schemaVersion: string; payload?: unknown }[];
  readonly approvalRequests: readonly Omit<ApprovalRequest, 'id'>[];
  readonly impactSnapshots: readonly Omit<ImpactMetrics, 'id'>[];
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
  /** Workflow-pack supplied semantic grouping for the generic observation timeline. */
  readonly timelineStep?: string;
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

export type RuntimeFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';
export interface RuntimeFieldDefinition {
  readonly name: string;
  readonly type: RuntimeFieldType;
  readonly required: boolean;
  readonly description: string;
}

export interface GeneratedRuntimeArtifacts {
  readonly agentSource: string;
  readonly testSource: string;
}

/** Pack-owned interpretation of a domain outcome; core only persists this generic trace. */
export interface EvaluationAssessment {
  readonly matchCategory: EvaluationMatchCategory;
  readonly appliedRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly confidence: number | null;
  readonly failureExplanation: string | null;
  readonly suggestedNextStep: string | null;
}

export const workflowPackSeedSchema = z.object({
  project: projectSchema,
  documents: z.array(documentEvidenceSchema),
  testCases: z.array(testCaseSchema),
  domainRecords: z.array(z.object({
    id: z.string().min(1), type: z.string().min(1), schemaVersion: z.string().min(1), payload: z.unknown(),
  })),
  approvalRequests: z.array(z.object({
    projectId: z.string().uuid(), workflowVersionId: z.string().uuid().nullable(), status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
    reason: z.string().min(1), riskLevel: z.enum(['low', 'medium', 'high']), requestedAction: z.string().min(1), agentRecommendation: z.string().min(1),
    confidence: z.number().min(0).max(1).nullable(), appliedRuleIds: z.array(z.string().min(1)), agentBuildId: z.string().uuid().nullable(),
    evidenceIds: z.array(z.string().uuid()).min(1), payload: z.record(z.unknown()), createdAt: z.string().datetime({ offset: true }),
  })).default([]),
  impactSnapshots: z.array(z.object({
    projectId: z.string().uuid(), workflowVersionId: z.string().uuid().nullable(), observedCases: z.number().int().nonnegative(),
    automationCoveragePercent: z.number().min(0).max(100), accuracyPercent: z.number().min(0).max(100), estimatedMinutesSaved: z.number().nonnegative(),
    manualSteps: z.number().int().nonnegative(), automatedSteps: z.number().int().nonnegative(), aiAssistedSteps: z.number().int().nonnegative(), humanRequiredSteps: z.number().int().nonnegative(),
    manualHandlingMinutes: z.number().nonnegative(), estimatedAutomatedMinutes: z.number().nonnegative(), reviewRatePercent: z.number().min(0).max(100), rulesDiscovered: z.number().int().nonnegative(), undocumentedExceptions: z.number().int().nonnegative(),
    sources: z.record(z.enum(['observed', 'estimated'])), assumptions: z.array(z.string().min(1)), capturedAt: z.string().datetime({ offset: true }),
  })).default([]),
});

export interface WorkflowPack<Input extends z.ZodType, Outcome extends z.ZodType> {
  readonly id: WorkflowType;
  readonly name: string;
  readonly version: string;
  readonly inputSchema: Input;
  readonly outcomeSchema: Outcome;
  /** Pack-owned types used to compile a generic executable workflow specification. */
  readonly runtimeSchema: { readonly inputs: readonly RuntimeFieldDefinition[]; readonly outputs: readonly RuntimeFieldDefinition[] };
  readonly workspaceDefinition: WorkspaceDefinition;
  readonly eventCatalog: readonly string[];
  readonly evidenceTypes: readonly string[];
  readonly supportedActions: readonly WorkspaceActionDefinition[];
  readonly approvalPolicy: unknown;
  readonly evaluationDefinition: unknown;
  readonly evaluateCase?: (input: {
    readonly testCase: TestCase; readonly actualOutcome: Record<string, unknown> | null; readonly executionError: string | null;
  }) => EvaluationAssessment;
  readonly promptContext: string;
  /** Pack-owned decision code and tests; the generic compiler only writes them. */
  readonly createGeneratedRuntimeArtifacts?: (specification: WorkflowSpecification) => GeneratedRuntimeArtifacts;
  /** A deterministic, pack-owned demo result when a model is not configured. */
  readonly reconstructionFallback?: (context: { readonly evidenceIds: readonly string[] }) => WorkflowReconstruction;
  /** Optional pack-owned answer interpretation; core persists the resulting generic workflow version. */
  readonly resolveClarificationAnswer?: (input: {
    readonly reconstruction: WorkflowReconstruction; readonly question: ClarificationQuestionDraft;
    readonly answer: ClarificationAnswerValue;
  }) => WorkflowReconstruction;
  readonly seedLoader: () => WorkflowPackSeed;
}

export function defineWorkflowPack<Input extends z.ZodType, Outcome extends z.ZodType>(
  workflowPack: WorkflowPack<Input, Outcome>,
): WorkflowPack<Input, Outcome> {
  return workflowPack;
}
