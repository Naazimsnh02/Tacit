import {
  extractedEvidenceSchema,
  workflowEventSchema,
  workflowReconstructionSchema,
  type EvidenceInsight,
  type ExtractedEvidence,
  type ObservationSession,
  type WorkflowEvent,
  type WorkflowReconstruction,
} from '@tacit/core-schemas';
import { createWorkflowReconstructionPrompt, workflowReconstructionPromptVersion } from '@tacit/prompts';
import type { WorkflowRegistry } from '@tacit/workflow-registry';

export interface ReconstructionModel {
  reconstruct(prompt: string): Promise<unknown>;
}

export interface ReconstructionRepository {
  getProject(projectId: string): Promise<{ id: string; workflowType: string; mode: 'production' | 'demo' } | null>;
  getSession(sessionId: string, projectId: string): Promise<ObservationSession | null>;
  getEvents(sessionId: string): Promise<readonly WorkflowEvent[]>;
  getEvidence(projectId: string): Promise<readonly ExtractedEvidence[]>;
  getEvidenceInsights?(projectId: string): Promise<readonly EvidenceInsight[]>;
  nextWorkflowVersion(projectId: string): Promise<number>;
  saveWorkflowVersion(value: {
    projectId: string; version: number; specification: WorkflowReconstruction;
    promptVersion: string; modelRole: string;
  }): Promise<{ id: string; version: number }>;
  saveRules(workflowVersionId: string, rules: WorkflowReconstruction['rules']): Promise<void>;
}

export class ReconstructionInputError extends Error {}
export class ReconstructionOutputError extends Error {}

export async function reconstructWorkflow(input: {
  projectId: string;
  sessionId: string;
  finalDecision: string | null;
  registry: WorkflowRegistry;
  repository: ReconstructionRepository;
  model?: ReconstructionModel;
}): Promise<{ workflowVersionId: string; version: number; reconstruction: WorkflowReconstruction; source: 'model' | 'seeded_fallback' }> {
  const project = await input.repository.getProject(input.projectId);
  if (!project) throw new ReconstructionInputError('Project not found.');
  const workflowPack = input.registry.get(project.workflowType);
  const session = await input.repository.getSession(input.sessionId, project.id);
  if (!session) throw new ReconstructionInputError('Observation session not found for this project.');
  if (session.status !== 'completed') throw new ReconstructionInputError('Complete the observation session before reconstructing a workflow.');

  const [events, evidence, sourceInsights] = await Promise.all([
    input.repository.getEvents(session.id), input.repository.getEvidence(project.id), input.repository.getEvidenceInsights?.(project.id) ?? [],
  ]);
  const parsedEvents = events.map((event) => workflowEventSchema.parse(event));
  const parsedEvidence = evidence.map((item) => extractedEvidenceSchema.parse(item));
  if (!parsedEvents.length) throw new ReconstructionInputError('Record at least one workflow event before reconstructing.');
  if (!parsedEvidence.length) throw new ReconstructionInputError('Attach at least one evidence record before reconstructing.');
  const evidenceIds = new Set(parsedEvidence.map((item) => item.id));
  const prompt = createWorkflowReconstructionPrompt({
    promptContext: workflowPack.promptContext, session, events: parsedEvents, evidence: parsedEvidence,
    sourceInsights,
    finalDecision: input.finalDecision,
  });
  let reconstruction: WorkflowReconstruction;
  let source: 'model' | 'seeded_fallback';
  if (input.model) {
    let attemptPrompt = prompt;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        reconstruction = validateEvidenceCitations(workflowReconstructionSchema.parse(await input.model.reconstruct(attemptPrompt)), evidenceIds);
        source = 'model';
        return persist({ reconstruction, source, projectId: project.id, repository: input.repository });
      } catch {
        attemptPrompt = `${prompt}\n\nYour prior response did not match the required JSON contract. Regenerate the complete object with every required field, including complete nested step and rule objects. Do not abbreviate fields or return prose.`;
      }
    }
    // Schema details are useful in server diagnostics but too noisy for the
    // recoverable UI state. The saved observation remains intact for retry.
    throw new ReconstructionOutputError('The workflow model could not produce a complete workflow after one retry. Your observation is saved; retry the reconstruction.');
  }
  if (project.mode !== 'demo' || !workflowPack.reconstructionFallback) {
    throw new ReconstructionOutputError('Workflow reconstruction is unavailable until the configured model is available.');
  }
  reconstruction = validateEvidenceCitations(workflowReconstructionSchema.parse(workflowPack.reconstructionFallback({ evidenceIds: [...evidenceIds] })), evidenceIds);
  source = 'seeded_fallback';
  return persist({ reconstruction, source, projectId: project.id, repository: input.repository });
}

/** Rejects a schema-valid hallucinated citation before it can become workflow state. */
function validateEvidenceCitations(reconstruction: WorkflowReconstruction, validEvidenceIds: ReadonlySet<string>): WorkflowReconstruction {
  const claims = [...reconstruction.steps, ...reconstruction.rules, ...reconstruction.contradictions];
  for (const claim of claims) {
    if (claim.evidenceIds.some((id) => !validEvidenceIds.has(id))) {
      throw new ReconstructionOutputError('The workflow model cited evidence that is not part of this project.');
    }
  }
  return reconstruction;
}

async function persist(input: {
  projectId: string; reconstruction: WorkflowReconstruction; source: 'model' | 'seeded_fallback'; repository: ReconstructionRepository;
}): Promise<{ workflowVersionId: string; version: number; reconstruction: WorkflowReconstruction; source: 'model' | 'seeded_fallback' }> {
  const version = await input.repository.nextWorkflowVersion(input.projectId);
  const workflowVersion = await input.repository.saveWorkflowVersion({
    projectId: input.projectId, version, specification: input.reconstruction,
    promptVersion: workflowReconstructionPromptVersion, modelRole: 'workflow_reasoning',
  });
  await input.repository.saveRules(workflowVersion.id, input.reconstruction.rules);
  return { workflowVersionId: workflowVersion.id, version: workflowVersion.version, reconstruction: input.reconstruction, source: input.source };
}
