import { workflowConfirmationSchema, workflowReconstructionSchema, type WorkflowConfirmation } from '@tacit/core-schemas';

export interface WorkflowConfirmationRepository {
  getWorkflowVersion(input: { projectId: string; workflowVersionId: string }): Promise<{ specification: unknown } | null>;
  getOpenClarificationCount(workflowVersionId: string): Promise<number>;
  saveConfirmation(value: WorkflowConfirmation): Promise<void>;
}

export class WorkflowConfirmationError extends Error {}

/** Records the required SME attestation after all evidence-backed rules are resolved. */
export async function confirmWorkflow(input: {
  projectId: string;
  workflowVersionId: string;
  actorId: string;
  confirmation: Omit<WorkflowConfirmation, 'projectId' | 'workflowVersionId' | 'confirmedBy' | 'createdAt'>;
  repository: WorkflowConfirmationRepository;
  now?: Date;
}): Promise<WorkflowConfirmation> {
  const workflowVersion = await input.repository.getWorkflowVersion({ projectId: input.projectId, workflowVersionId: input.workflowVersionId });
  if (!workflowVersion) throw new WorkflowConfirmationError('Workflow version not found for this project.');
  const reconstruction = workflowReconstructionSchema.parse(workflowVersion.specification);
  if (reconstruction.rules.some((rule) => rule.verificationStatus !== 'confirmed')) {
    throw new WorkflowConfirmationError('Confirm every workflow rule before confirming this workflow.');
  }
  if (await input.repository.getOpenClarificationCount(input.workflowVersionId)) {
    throw new WorkflowConfirmationError('Resolve all clarification questions before confirming this workflow.');
  }
  const confirmation = workflowConfirmationSchema.parse({
    workflowVersionId: input.workflowVersionId,
    projectId: input.projectId,
    confirmedBy: input.actorId,
    ...input.confirmation,
    createdAt: (input.now ?? new Date()).toISOString(),
  });
  await input.repository.saveConfirmation(confirmation);
  return confirmation;
}
