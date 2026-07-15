import {
  documentEvidenceSchema,
  workflowEventSchema,
  workflowReconstructionSchema,
  type DocumentEvidence,
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
  getProject(projectId: string): Promise<{ id: string; workflowType: string } | null>;
  getSession(sessionId: string, projectId: string): Promise<ObservationSession | null>;
  getEvents(sessionId: string): Promise<readonly WorkflowEvent[]>;
  getEvidence(projectId: string, sessionId: string): Promise<readonly DocumentEvidence[]>;
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

  const [events, evidence] = await Promise.all([
    input.repository.getEvents(session.id), input.repository.getEvidence(project.id, session.id),
  ]);
  const parsedEvents = events.map((event) => workflowEventSchema.parse(event));
  const parsedEvidence = evidence.map((item) => documentEvidenceSchema.parse(item));
  if (!parsedEvents.length) throw new ReconstructionInputError('Record at least one workflow event before reconstructing.');
  if (!parsedEvidence.length) throw new ReconstructionInputError('Attach at least one evidence record before reconstructing.');
  const unsupportedEvidence = parsedEvidence.find((item) => !workflowPack.evidenceTypes.includes(item.evidenceType));
  if (unsupportedEvidence) throw new ReconstructionInputError(`Unsupported evidence type: ${unsupportedEvidence.evidenceType}.`);

  const evidenceIds = [...new Set([...parsedEvidence.map((item) => item.id), ...parsedEvents.flatMap((event) => event.evidenceIds)])];
  const prompt = createWorkflowReconstructionPrompt({
    promptContext: workflowPack.promptContext, session, events: parsedEvents, evidence: parsedEvidence,
    finalDecision: input.finalDecision,
  });
  let reconstruction: WorkflowReconstruction;
  let source: 'model' | 'seeded_fallback';
  if (input.model) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        reconstruction = workflowReconstructionSchema.parse(await input.model.reconstruct(prompt));
        source = 'model';
        return persist({ reconstruction, source, projectId: project.id, repository: input.repository });
      } catch (error) {
        lastError = error;
      }
    }
    throw new ReconstructionOutputError(`The workflow model returned an invalid reconstruction after one retry. ${lastError instanceof Error ? lastError.message : ''}`.trim());
  }
  if (!workflowPack.reconstructionFallback) throw new ReconstructionOutputError('Workflow reconstruction is unavailable until a model is configured.');
  reconstruction = workflowReconstructionSchema.parse(workflowPack.reconstructionFallback({ evidenceIds }));
  source = 'seeded_fallback';
  return persist({ reconstruction, source, projectId: project.id, repository: input.repository });
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
