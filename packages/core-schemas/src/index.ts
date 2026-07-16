import { z } from 'zod';

export const workflowTypeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, {
  message: 'Workflow types must use lowercase snake_case.',
});
export const identifierSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: true });
export const jsonObjectSchema = z.record(z.unknown());

export const projectStatusSchema = z.enum(['draft', 'active', 'archived']);
export const productModeSchema = z.enum(['production', 'demo']);
export const organizationRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export const organizationSchema = z.object({
  id: identifierSchema, name: z.string().min(1).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  mode: productModeSchema, createdBy: identifierSchema.nullable(), createdAt: timestampSchema,
});
export const organizationMembershipSchema = z.object({
  organizationId: identifierSchema, userId: identifierSchema, role: organizationRoleSchema, createdAt: timestampSchema,
});
export const projectSchema = z.object({
  id: identifierSchema, organizationId: identifierSchema, mode: productModeSchema, createdBy: identifierSchema.nullable(),
  name: z.string().min(1).max(160), workflowType: workflowTypeSchema,
  status: projectStatusSchema, configuration: jsonObjectSchema.default({}),
  createdAt: timestampSchema, updatedAt: timestampSchema,
});

export const observationSessionStatusSchema = z.enum(['recording', 'paused', 'completed', 'abandoned']);
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

/** The original, tenant-owned binary submitted as workflow evidence. */
export const evidenceArtifactTypeSchema = z.enum(['sop', 'document', 'spreadsheet', 'image', 'audio', 'video']);
export const evidenceArtifactStatusSchema = z.enum(['uploading', 'queued', 'processing', 'ready', 'failed', 'deleted']);
export const evidenceScanStatusSchema = z.enum(['pending', 'clean', 'blocked', 'failed']);
export const evidenceArtifactSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, organizationId: identifierSchema,
  evidenceType: evidenceArtifactTypeSchema, filename: z.string().min(1).max(255), displayName: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(160), byteSize: z.number().int().positive(), checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  storageKey: z.string().min(1), storageVersion: z.string().nullable(), status: evidenceArtifactStatusSchema,
  scanStatus: evidenceScanStatusSchema, processingConsentAt: timestampSchema, retentionExpiresAt: timestampSchema.nullable(),
  failureReason: z.string().min(1).nullable(), createdAt: timestampSchema, updatedAt: timestampSchema,
});
export const evidenceExtractionKindSchema = z.enum(['text', 'ocr', 'transcript', 'frame', 'spreadsheet']);
export const evidenceCitationSchema = z.object({
  artifactId: identifierSchema, extractionId: identifierSchema, pageStart: z.number().int().positive().nullable(),
  pageEnd: z.number().int().positive().nullable(), timeStartMs: z.number().int().nonnegative().nullable(),
  timeEndMs: z.number().int().nonnegative().nullable(),
});
export const extractedEvidenceSchema = z.object({
  id: identifierSchema, artifactId: identifierSchema, kind: evidenceExtractionKindSchema, content: z.string().min(1),
  pageStart: z.number().int().positive().nullable(), pageEnd: z.number().int().positive().nullable(),
  timeStartMs: z.number().int().nonnegative().nullable(), timeEndMs: z.number().int().nonnegative().nullable(),
  confidence: z.number().min(0).max(1), sourceArtifactVersion: z.string().min(1), createdAt: timestampSchema,
});

export const automationBoundarySchema = z.enum(['deterministic', 'ai_judgment', 'human_approval', 'unsupported']);
export const contradictionSeveritySchema = z.enum(['low', 'medium', 'high']);
export const workflowStepSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), description: z.string().min(1),
  boundary: automationBoundarySchema, evidenceIds: z.array(identifierSchema).min(1),
});

export const reconstructedWorkflowStepTypeSchema = z.enum([
  'action', 'deterministic_rule', 'ai_judgment', 'human_decision', 'approval', 'escalation',
]);
export const reconstructionConfidenceSchema = z.number().min(0).max(1);
export const reconstructedWorkflowStepSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), description: z.string().min(1),
  type: reconstructedWorkflowStepTypeSchema, sequence: z.number().int().positive(),
  inputs: z.array(z.string().min(1)), outputs: z.array(z.string().min(1)),
  evidenceIds: z.array(identifierSchema).min(1), confidence: reconstructionConfidenceSchema,
});
export const reconstructedRuleSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), condition: z.string().min(1),
  action: z.string().min(1), exceptions: z.array(z.string().min(1)),
  confidence: reconstructionConfidenceSchema, evidenceIds: z.array(identifierSchema).min(1),
  verificationStatus: z.enum(['inferred', 'confirmed', 'unverified']),
  riskLevel: z.enum(['low', 'medium', 'high']),
});
export const reconstructedContradictionSchema = z.object({
  id: z.string().min(1), sourceA: z.string().min(1), sourceB: z.string().min(1),
  description: z.string().min(1), businessImpact: z.string().min(1),
  severity: contradictionSeveritySchema, evidenceIds: z.array(identifierSchema).min(1),
  requiresClarification: z.boolean(),
});
export const workflowReconstructionSchema = z.object({
  workflowObjective: z.string().min(1), inputs: z.array(z.string().min(1)),
  steps: z.array(reconstructedWorkflowStepSchema).min(1),
  decisionPoints: z.array(z.string().min(1)), rules: z.array(reconstructedRuleSchema).min(1),
  exceptions: z.array(z.string().min(1)), contradictions: z.array(reconstructedContradictionSchema),
  unknowns: z.array(z.string().min(1)), approvalRequirements: z.array(z.string().min(1)),
  automationCandidates: z.array(z.string().min(1)),
});

export const decisionRuleStatusSchema = z.enum(['inferred', 'confirmed', 'rejected']);
export const decisionRuleSchema = z.object({
  id: identifierSchema, workflowVersionId: identifierSchema, title: z.string().min(1),
  condition: z.string().min(1), outcome: z.string().min(1), boundary: automationBoundarySchema,
  status: decisionRuleStatusSchema, evidenceIds: z.array(identifierSchema).min(1), createdAt: timestampSchema,
});

export const contradictionSchema = z.object({
  id: z.string().min(1), description: z.string().min(1), severity: contradictionSeveritySchema,
  evidenceIds: z.array(identifierSchema).min(2),
});

export const clarificationQuestionStatusSchema = z.enum(['open', 'answered', 'dismissed']);
export const clarificationAnswerTypeSchema = z.enum(['single_select', 'multi_select', 'number', 'boolean', 'free_text']);
export const clarificationSuggestedAnswerSchema = z.object({ label: z.string().min(1), value: z.string().min(1) });
export const clarificationAnswerValueSchema = z.union([z.string().min(1), z.number().finite(), z.boolean(), z.array(z.string().min(1)).min(1)]);
export const clarificationQuestionDraftSchema = z.object({
  id: z.string().min(1), question: z.string().min(1), rationale: z.string().min(1),
  relatedRuleId: z.string().min(1).nullable(), evidenceIds: z.array(identifierSchema).min(1),
  answerType: clarificationAnswerTypeSchema, suggestedAnswers: z.array(clarificationSuggestedAnswerSchema),
  riskIfUnanswered: z.string().min(1),
});
export const clarificationQuestionSchema = z.object({
  id: identifierSchema, workflowVersionId: identifierSchema, question: z.string().min(1),
  rationale: z.string().min(1), status: clarificationQuestionStatusSchema, answer: z.string().nullable(),
  relatedRuleId: z.string().min(1).nullable(), evidenceIds: z.array(identifierSchema).min(1),
  answerType: clarificationAnswerTypeSchema, suggestedAnswers: z.array(clarificationSuggestedAnswerSchema),
  riskIfUnanswered: z.string().min(1), answerValue: clarificationAnswerValueSchema.nullable(),
  createdAt: timestampSchema, answeredAt: timestampSchema.nullable(),
});

export const runtimeFieldTypeSchema = z.enum(['string', 'number', 'boolean', 'object', 'array']);
export const runtimeFieldSchema = z.object({
  name: z.string().min(1), type: runtimeFieldTypeSchema, required: z.boolean(), description: z.string().min(1),
});
export const executableWorkflowRuleSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), description: z.string().min(1), condition: z.string().min(1),
  action: z.string().min(1), exceptions: z.array(z.string().min(1)), riskLevel: contradictionSeveritySchema,
  evidenceIds: z.array(identifierSchema).min(1), deterministic: z.boolean(),
});
/** A domain-agnostic contract consumed by the agent runtime and build pipeline. */
export const workflowSpecificationSchema = z.object({
  name: z.string().min(1), version: z.string().min(1), description: z.string().min(1),
  workflowVersionId: identifierSchema, inputs: z.array(runtimeFieldSchema).min(1),
  steps: z.array(workflowStepSchema).min(1), rules: z.array(executableWorkflowRuleSchema).min(1),
  approvalPolicy: jsonObjectSchema, escalationPolicy: z.object({ conditions: z.array(z.string().min(1)) }),
  outputSchema: z.array(runtimeFieldSchema).min(1), auditPolicy: z.object({ evidenceRequired: z.boolean(), retainDecisionTrace: z.boolean() }),
  testCaseIds: z.array(identifierSchema),
});
export const workflowVersionStatusSchema = z.enum(['draft', 'active', 'superseded']);
export const workflowVersionSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, version: z.number().int().positive(),
  status: workflowVersionStatusSchema, specification: z.unknown().nullable(),
  promptVersion: z.string().min(1).nullable(), modelRole: z.string().min(1).nullable(), createdAt: timestampSchema,
});

export const agentBuildStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'stale']);
export const agentBuildSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, workflowVersionId: identifierSchema,
  status: agentBuildStatusSchema, artifactPath: z.string().nullable(), manifest: jsonObjectSchema.nullable(),
  failureReason: z.string().nullable(), createdAt: timestampSchema, completedAt: timestampSchema.nullable(),
});
export const agentBuildLogSchema = z.object({
  id: identifierSchema, agentBuildId: identifierSchema, stage: z.string().min(1), message: z.string().min(1),
  createdAt: timestampSchema,
});

export const testCaseSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, label: z.string().min(1), input: jsonObjectSchema,
  expectedOutcome: jsonObjectSchema, evidenceIds: z.array(identifierSchema).default([]), createdAt: timestampSchema,
});
export const testRunStatusSchema = z.enum(['queued', 'running', 'passed', 'failed']);
export const testResultStatusSchema = z.enum(['passed', 'failed', 'skipped']);
/** Domain-neutral classification of an agent result against a labelled historical case. */
export const evaluationMatchCategorySchema = z.enum([
  'exact_match', 'acceptable_alternative', 'correct_escalation', 'incorrect', 'needs_clarification', 'execution_failure',
]);
export const testRunTypeSchema = z.enum(['generated_tests', 'historical_replay']);
export const testRunSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, workflowVersionId: identifierSchema,
  agentBuildId: identifierSchema.nullable(), status: testRunStatusSchema, startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(), runType: testRunTypeSchema.default('generated_tests'),
});
export const testResultSchema = z.object({
  id: identifierSchema, testRunId: identifierSchema, testCaseId: identifierSchema, status: testResultStatusSchema,
  actualOutcome: jsonObjectSchema.nullable(), message: z.string().nullable(), createdAt: timestampSchema,
  matchCategory: evaluationMatchCategorySchema.nullable().default(null), appliedRuleIds: z.array(z.string().min(1)).default([]),
  evidenceIds: z.array(identifierSchema).default([]), confidence: z.number().min(0).max(1).nullable().default(null),
  failureExplanation: z.string().nullable().default(null), suggestedNextStep: z.string().nullable().default(null),
});

export const approvalRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
export const approvalDecisionSchema = z.enum(['approved', 'rejected', 'request_more_information', 'escalated']);
export const approvalRequestSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, workflowVersionId: identifierSchema.nullable(),
  status: approvalRequestStatusSchema, reason: z.string().min(1), riskLevel: contradictionSeveritySchema,
  requestedAction: z.string().min(1), agentRecommendation: z.string().min(1), confidence: z.number().min(0).max(1).nullable(),
  appliedRuleIds: z.array(z.string().min(1)).default([]), agentBuildId: identifierSchema.nullable(),
  evidenceIds: z.array(identifierSchema).min(1), payload: jsonObjectSchema, createdAt: timestampSchema,
});
export const approvalActionSchema = z.object({
  id: identifierSchema, approvalRequestId: identifierSchema, decision: approvalDecisionSchema,
  comment: z.string().nullable(), approver: z.string().min(1), actedAt: timestampSchema,
});

export const impactMetricSourceSchema = z.enum(['observed', 'estimated']);
export const impactMetricsSchema = z.object({
  id: identifierSchema, projectId: identifierSchema, workflowVersionId: identifierSchema.nullable(),
  observedCases: z.number().int().nonnegative(), automationCoveragePercent: z.number().min(0).max(100),
  accuracyPercent: z.number().min(0).max(100), estimatedMinutesSaved: z.number().nonnegative(),
  manualSteps: z.number().int().nonnegative(), automatedSteps: z.number().int().nonnegative(), aiAssistedSteps: z.number().int().nonnegative(),
  humanRequiredSteps: z.number().int().nonnegative(), manualHandlingMinutes: z.number().nonnegative(), estimatedAutomatedMinutes: z.number().nonnegative(),
  reviewRatePercent: z.number().min(0).max(100), rulesDiscovered: z.number().int().nonnegative(), undocumentedExceptions: z.number().int().nonnegative(),
  sources: z.record(impactMetricSourceSchema), assumptions: z.array(z.string().min(1)), capturedAt: timestampSchema,
});

export type WorkflowType = z.infer<typeof workflowTypeSchema>;
export type ProductMode = z.infer<typeof productModeSchema>;
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationMembership = z.infer<typeof organizationMembershipSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ObservationSession = z.infer<typeof observationSessionSchema>;
export type WorkflowEvent = z.infer<typeof workflowEventSchema>;
export type DocumentEvidence = z.infer<typeof documentEvidenceSchema>;
export type EvidenceArtifact = z.infer<typeof evidenceArtifactSchema>;
export type EvidenceArtifactType = z.infer<typeof evidenceArtifactTypeSchema>;
export type EvidenceArtifactStatus = z.infer<typeof evidenceArtifactStatusSchema>;
export type EvidenceCitation = z.infer<typeof evidenceCitationSchema>;
export type ExtractedEvidence = z.infer<typeof extractedEvidenceSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowReconstruction = z.infer<typeof workflowReconstructionSchema>;
export type ReconstructedWorkflowStep = z.infer<typeof reconstructedWorkflowStepSchema>;
export type ReconstructedRule = z.infer<typeof reconstructedRuleSchema>;
export type DecisionRule = z.infer<typeof decisionRuleSchema>;
export type Contradiction = z.infer<typeof contradictionSchema>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type ClarificationQuestionDraft = z.infer<typeof clarificationQuestionDraftSchema>;
export type ClarificationAnswerValue = z.infer<typeof clarificationAnswerValueSchema>;
export type WorkflowSpecification = z.infer<typeof workflowSpecificationSchema>;
export type AgentBuild = z.infer<typeof agentBuildSchema>;
export type AgentBuildLog = z.infer<typeof agentBuildLogSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type EvaluationMatchCategory = z.infer<typeof evaluationMatchCategorySchema>;
export type TestRun = z.infer<typeof testRunSchema>;
export type TestResult = z.infer<typeof testResultSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ApprovalAction = z.infer<typeof approvalActionSchema>;
export type ImpactMetrics = z.infer<typeof impactMetricsSchema>;
