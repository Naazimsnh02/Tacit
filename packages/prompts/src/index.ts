export type ModelRole = 'workflow_reasoning' | 'event_extraction' | 'clarification' | 'evaluation' | 'explanation';

export const workflowReconstructionPromptVersion = 'workflow-reconstruction-v1';

export function createWorkflowReconstructionPrompt(input: {
  readonly promptContext: string;
  readonly session: unknown;
  readonly events: unknown;
  readonly evidence: unknown;
  readonly finalDecision: string | null;
}): string {
  return `Reconstruct a workflow from the supplied evidence. ${input.promptContext}\n\nReturn JSON only with workflowObjective, inputs, steps, decisionPoints, rules, exceptions, contradictions, unknowns, approvalRequirements, and automationCandidates. Every step and rule must cite evidenceIds. Do not invent unsupported rules.\n\nObservation session: ${JSON.stringify(input.session)}\nEvents: ${JSON.stringify(input.events)}\nEvidence: ${JSON.stringify(input.evidence)}\nFinal SME decision: ${input.finalDecision ?? 'not provided'}`;
}
