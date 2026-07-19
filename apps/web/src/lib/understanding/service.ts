import { randomUUID } from 'node:crypto';
import type { EvidenceInsight, ExtractedEvidence, ObservationSession, WorkflowEvent } from '@tacit/core-schemas';

export interface AutomatedUnderstandingObservation {
  readonly session: ObservationSession;
  readonly events: readonly WorkflowEvent[];
}

const PACKAGE_STEP_KIND = 'package_suggested_step';
const PACKAGE_DECISION_KINDS = new Set(['package_policy_rule', 'package_never_automate']);

/**
 * Produces the durable, evidence-linked observation record used by the existing
 * reconstruction service. Domain-neutral: when package synthesis has produced
 * suggested steps, those become ordered process events; otherwise each ready
 * source is represented as a system analysis event (legacy-compatible path).
 */
export function createAutomatedUnderstandingObservation(input: {
  readonly projectId: string;
  readonly evidence: readonly ExtractedEvidence[];
  readonly insights?: readonly EvidenceInsight[];
  readonly now?: Date;
  readonly createId?: () => string;
}): AutomatedUnderstandingObservation {
  if (!input.evidence.length) throw new AutomatedUnderstandingInputError('Add at least one processed source before Tacit can understand the process.');
  const createId = input.createId ?? randomUUID;
  const timestamp = (input.now ?? new Date()).toISOString();
  const sessionId = createId();
  const processEvents = createProcessEventsFromInsights({
    sessionId,
    insights: input.insights ?? [],
    createId,
    timestamp,
  });
  const sourceEvents = processEvents.length ? [] : createSourceAnalysisEvents({
    sessionId,
    evidence: input.evidence,
    createId,
    timestamp,
  });
  const events = processEvents.length ? processEvents : sourceEvents;
  const packageSteps = (input.insights ?? []).filter((insight) => insight.kind === PACKAGE_STEP_KIND).length;
  const sourceCount = new Set(input.evidence.map((item) => item.artifactId)).size;
  const narration = packageSteps
    ? `Tacit synthesized ${packageSteps} process step${packageSteps === 1 ? '' : 's'} from ${sourceCount} source${sourceCount === 1 ? '' : 's'} and ${input.evidence.length} extracted evidence segment${input.evidence.length === 1 ? '' : 's'}.`
    : `Tacit combined ${sourceCount} source${sourceCount === 1 ? '' : 's'} and ${input.evidence.length} extracted evidence segment${input.evidence.length === 1 ? '' : 's'} to draft the process.`;
  return {
    session: {
      id: sessionId,
      projectId: input.projectId,
      status: 'completed',
      startedAt: timestamp,
      completedAt: timestamp,
      narration,
      createdAt: timestamp,
    },
    events,
  };
}

function createProcessEventsFromInsights(input: {
  readonly sessionId: string;
  readonly insights: readonly EvidenceInsight[];
  readonly createId: () => string;
  readonly timestamp: string;
}): WorkflowEvent[] {
  const steps = input.insights
    .filter((insight) => insight.kind === PACKAGE_STEP_KIND)
    .slice()
    .sort((left, right) => {
      const leftOrder = Number.parseInt(left.entityValue ?? '', 10);
      const rightOrder = Number.parseInt(right.entityValue ?? '', 10);
      const leftRank = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
      const rightRank = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.createdAt.localeCompare(right.createdAt);
    });
  const events = steps.map((insight, index): WorkflowEvent => ({
    id: input.createId(),
    observationSessionId: input.sessionId,
    source: 'system',
    action: 'inferred_process_step',
    occurredAt: input.timestamp,
    payload: {
      source: 'package_synthesis',
      sequence: index + 1,
      stepName: insight.entityValue ?? insight.content.slice(0, 120),
      stepKind: insight.entityType ?? 'action',
      statement: insight.content,
      confidence: insight.confidence,
    },
    evidenceIds: [...insight.extractionIds],
  }));
  for (const insight of input.insights.filter((item) => PACKAGE_DECISION_KINDS.has(item.kind))) {
    events.push({
      id: input.createId(),
      observationSessionId: input.sessionId,
      source: 'system',
      action: insight.kind === 'package_never_automate' ? 'inferred_automation_boundary' : 'inferred_policy_rule',
      occurredAt: input.timestamp,
      payload: {
        source: 'package_synthesis',
        statement: insight.content,
        confidence: insight.confidence,
        kind: insight.kind,
      },
      evidenceIds: [...insight.extractionIds],
    });
  }
  return events;
}

function createSourceAnalysisEvents(input: {
  readonly sessionId: string;
  readonly evidence: readonly ExtractedEvidence[];
  readonly createId: () => string;
  readonly timestamp: string;
}): WorkflowEvent[] {
  const byArtifact = new Map<string, ExtractedEvidence[]>();
  for (const extraction of input.evidence) {
    const values = byArtifact.get(extraction.artifactId) ?? [];
    values.push(extraction);
    byArtifact.set(extraction.artifactId, values);
  }
  return [...byArtifact.values()].map((extractions, index): WorkflowEvent => ({
    id: input.createId(),
    observationSessionId: input.sessionId,
    source: 'system',
    action: 'analyze_source_material',
    occurredAt: input.timestamp,
    payload: {
      source: 'automatic_understanding',
      artifactId: extractions[0]?.artifactId,
      extractionCount: extractions.length,
      extractionKinds: [...new Set(extractions.map((item) => item.kind))],
      sequence: index + 1,
    },
    evidenceIds: extractions.map((item) => item.id),
  }));
}

export class AutomatedUnderstandingInputError extends Error {}
