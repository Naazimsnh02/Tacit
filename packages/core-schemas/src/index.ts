import { z } from 'zod';

export const workflowTypeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, {
  message: 'Workflow types must use lowercase snake_case.',
});
export const identifierSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: true });
export const jsonObjectSchema = z.record(z.unknown());

export const projectStatusSchema = z.enum(['draft', 'active', 'archived']);
export const projectSchema = z.object({
  id: identifierSchema, name: z.string().min(1).max(160), workflowType: workflowTypeSchema,
  status: projectStatusSchema, configuration: jsonObjectSchema.default({}),
  createdAt: timestampSchema, updatedAt: timestampSchema,
});

export const observationSessionStatusSchema = z.enum(['recording', 'completed', 'abandoned']);
export const observationSessionSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, status: observationSessionStatusSchema,
  startedAt: timestampSchema, completedAt: timestampSchema.nullable(), narration: z.string().nullable(),
  createdAt: timestampSchema,
});

export const workflowEventSourceSchema = z.enum(['user', 'system', 'import']);
export const workflowEventSchema = z.object({
  id: identifierSchema, observationSessionId: identifierSchema, source: workflowEventSourceSchema,
  action: z.string().min(1), occurredAt: timestampSchema, payload: jsonObjectSchema,
  evidenceIds: z.array(identifierSchema).default([]),
});

export const documentEvidenceSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, observationSessionId: identifierSchema.nullable(),
  evidenceType: z.string().min(1), title: z.string().min(1), mediaType: z.string().min(1),
  storageKey: z.string().min(1), schemaVersion: z.string().min(1), metadata: jsonObjectSchema.default({}),
  createdAt: timestampSchema,
});

export const automationBoundarySchema = z.enum(['deterministic', 'ai_judgment', 'human_approval', 'unsupported']);
export const workflowStepSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), description: z.string().min(1),
  boundary: automationBoundarySchema, evidenceIds: z.array(identifierSchema).min(1),
});

export const decisionRuleStatusSchema = z.enum(['inferred', 'confirmed', 'rejected']);
export const decisionRuleSchema = z.object({
  id: identifierSchema, workflowVersionId: identifierSchema, title: z.string().min(1),
  condition: z.string().min(1), outcome: z.string().min(1), boundary: automationBoundarySchema,
  status: decisionRuleStatusSchema, evidenceIds: z.array(identifierSchema).min(1), createdAt: timestampSchema,
});

export const contradictionSeveritySchema = z.enum(['low', 'medium', 'high']);
export const contradictionSchema = z.object({
  id: z.string().min(1), description: z.string().min(1), severity: contradictionSeveritySchema,
  evidenceIds: z.array(identifierSchema).min(2),
});

export const clarificationQuestionStatusSchema = z.enum(['open', 'answered', 'dismissed']);
export const clarificationQuestionSchema = z.object({
  id: identifierSchema, workflowVersionId: identifierSchema, question: z.string().min(1),
  rationale: z.string().min(1), status: clarificationQuestionStatusSchema, answer: z.string().nullable(),
  evidenceIds: z.array(identifierSchema).min(1), createdAt: timestampSchema, answeredAt: timestampSchema.nullable(),
});

export const workflowSpecificationSchema = z.object({
  workflowVersionId: identifierSchema, steps: z.array(workflowStepSchema), rules: z.array(decisionRuleSchema),
  approvalBoundaries: z.array(z.string().min(1)),
});
export const workflowVersionStatusSchema = z.enum(['draft', 'active', 'superseded']);
export const workflowVersionSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, version: z.number().int().positive(),
  status: workflowVersionStatusSchema, specification: workflowSpecificationSchema.nullable(), createdAt: timestampSchema,
});

export const agentBuildStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export const agentBuildSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, workflowVersionId: identifierSchema,
  status: agentBuildStatusSchema, artifactPath: z.string().nullable(), manifest: jsonObjectSchema.nullable(),
  failureReason: z.string().nullable(), createdAt: timestampSchema, completedAt: timestampSchema.nullable(),
});

export const testCaseSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, label: z.string().min(1), input: jsonObjectSchema,
  expectedOutcome: jsonObjectSchema, evidenceIds: z.array(identifierSchema).default([]), createdAt: timestampSchema,
});
export const testRunStatusSchema = z.enum(['queued', 'running', 'passed', 'failed']);
export const testResultStatusSchema = z.enum(['passed', 'failed', 'skipped']);
export const testRunSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, workflowVersionId: identifierSchema,
  agentBuildId: identifierSchema.nullable(), status: testRunStatusSchema, startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
});
export const testResultSchema = z.object({
  id: identifierSchema, testRunId: identifierSchema, testCaseId: identifierSchema, status: testResultStatusSchema,
  actualOutcome: jsonObjectSchema.nullable(), message: z.string().nullable(), createdAt: timestampSchema,
});

export const approvalRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
export const approvalRequestSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, workflowVersionId: identifierSchema.nullable(),
  status: approvalRequestStatusSchema, reason: z.string().min(1), riskLevel: contradictionSeveritySchema,
  evidenceIds: z.array(identifierSchema).min(1), payload: jsonObjectSchema, createdAt: timestampSchema,
});
export const approvalActionSchema = z.object({
  id: identifierSchema, approvalRequestId: identifierSchema, decision: z.enum(['approved', 'rejected']),
  comment: z.string().nullable(), actedAt: timestampSchema,
});

export const impactMetricsSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, workflowVersionId: identifierSchema.nullable(),
  observedCases: z.number().int().nonnegative(), automationCoveragePercent: z.number().min(0).max(100),
  accuracyPercent: z.number().min(0).max(100), estimatedMinutesSaved: z.number().nonnegative(),
  assumptions: z.array(z.string().min(1)), capturedAt: timestampSchema,
});

export type WorkflowType = z.infer<typeof workflowTypeSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ObservationSession = z.infer<typeof observationSessionSchema>;
export type WorkflowEvent = z.infer<typeof workflowEventSchema>;
export type DocumentEvidence = z.infer<typeof documentEvidenceSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type DecisionRule = z.infer<typeof decisionRuleSchema>;
export type Contradiction = z.infer<typeof contradictionSchema>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type WorkflowSpecification = z.infer<typeof workflowSpecificationSchema>;
export type AgentBuild = z.infer<typeof agentBuildSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type TestResult = z.infer<typeof testResultSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ImpactMetrics = z.infer<typeof impactMetricsSchema>;
