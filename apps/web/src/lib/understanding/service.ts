import { randomUUID } from 'node:crypto';
import type { ExtractedEvidence, ObservationSession, WorkflowEvent } from '@tacit/core-schemas';

export interface AutomatedUnderstandingObservation {
  readonly session: ObservationSession;
  readonly events: readonly WorkflowEvent[];
}

/**
 * Produces the durable, evidence-linked observation record used by the existing
 * reconstruction service. This is intentionally domain-neutral: workflow packs
 * still interpret the resulting workflow, while Tacit starts from every ready
 * source instead of asking an SME to manually recreate its first steps.
 */
export function createAutomatedUnderstandingObservation(input: {
  readonly projectId: string;
  readonly evidence: readonly ExtractedEvidence[];
  readonly now?: Date;
  readonly createId?: () => string;
}): AutomatedUnderstandingObservation {
  if (!input.evidence.length) throw new AutomatedUnderstandingInputError('Add at least one processed source before Tacit can understand the process.');
  const createId = input.createId ?? randomUUID;
  const timestamp = (input.now ?? new Date()).toISOString();
  const sessionId = createId();
  const byArtifact = new Map<string, ExtractedEvidence[]>();
  for (const extraction of input.evidence) {
    const values = byArtifact.get(extraction.artifactId) ?? [];
    values.push(extraction);
    byArtifact.set(extraction.artifactId, values);
  }
  const events = [...byArtifact.values()].map((extractions, index): WorkflowEvent => ({
    id: createId(),
    observationSessionId: sessionId,
    source: 'system',
    action: 'analyze_source_material',
    occurredAt: timestamp,
    payload: {
      source: 'automatic_understanding',
      artifactId: extractions[0]?.artifactId,
      extractionCount: extractions.length,
      extractionKinds: [...new Set(extractions.map((item) => item.kind))],
      sequence: index + 1,
    },
    evidenceIds: extractions.map((item) => item.id),
  }));
  return {
    session: {
      id: sessionId,
      projectId: input.projectId,
      status: 'completed',
      startedAt: timestamp,
      completedAt: timestamp,
      narration: `Tacit combined ${byArtifact.size} source${byArtifact.size === 1 ? '' : 's'} and ${input.evidence.length} extracted evidence segment${input.evidence.length === 1 ? '' : 's'} to draft the process.`,
      createdAt: timestamp,
    },
    events,
  };
}

export class AutomatedUnderstandingInputError extends Error {}
