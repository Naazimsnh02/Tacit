export type ModelRole = 'workflow_reasoning' | 'event_extraction' | 'clarification' | 'evaluation' | 'explanation';

export const workflowReconstructionPromptVersion = 'workflow-reconstruction-v2';

export function createWorkflowReconstructionPrompt(input: {
  readonly promptContext: string;
  readonly session: unknown;
  readonly events: unknown;
  readonly evidence: unknown;
  readonly finalDecision: string | null;
}): string {
  return `Reconstruct a workflow from the supplied evidence. ${input.promptContext}\n\nReturn only the requested structured JSON. Every workflow claim (steps, rules, and contradictions) must cite one or more supplied extraction IDs in evidenceIds. Do not cite event IDs or artifact IDs. Do not invent unsupported rules; preserve unresolved uncertainty in unknowns and route unsafe work to an approval or escalation boundary.\n\nObservation session: ${JSON.stringify(input.session)}\nEvents: ${JSON.stringify(input.events)}\nExtracted evidence with durable page/time citations: ${JSON.stringify(input.evidence)}\nFinal SME decision: ${input.finalDecision ?? 'not provided'}`;
}
