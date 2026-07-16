import type { WorkflowSpecification } from '@tacit/core-schemas';

export type ModelRole = 'workflow_reasoning' | 'event_extraction' | 'clarification' | 'evaluation' | 'explanation' | 'agent_compilation';

export const workflowReconstructionPromptVersion = 'workflow-reconstruction-v2';
export const agentCompilationPromptVersion = 'agent-compilation-v1';

export function createWorkflowReconstructionPrompt(input: {
  readonly promptContext: string;
  readonly session: unknown;
  readonly events: unknown;
  readonly evidence: unknown;
  readonly finalDecision: string | null;
}): string {
  return `Reconstruct a workflow from the supplied evidence. ${input.promptContext}\n\nReturn only the requested structured JSON. Every workflow claim (steps, rules, and contradictions) must cite one or more supplied extraction IDs in evidenceIds. Do not cite event IDs or artifact IDs. Do not invent unsupported rules; preserve unresolved uncertainty in unknowns and route unsafe work to an approval or escalation boundary.\n\nObservation session: ${JSON.stringify(input.session)}\nEvents: ${JSON.stringify(input.events)}\nExtracted evidence with durable page/time citations: ${JSON.stringify(input.evidence)}\nFinal SME decision: ${input.finalDecision ?? 'not provided'}`;
}

/**
 * The compiler deliberately receives only this confirmed, typed IR. Source
 * artifacts, video, transcripts, and unconfirmed reconstruction data never
 * enter the code-generation prompt.
 */
export function createAgentCompilationPrompt(input: {
  readonly specification: WorkflowSpecification;
  readonly repair: { readonly failureReport: unknown; readonly previousSource: string; readonly previousTests: string } | null;
}): string {
  const repairInstruction = input.repair
    ? `Repair the generated implementation below. Address the reported validation or test failure without changing the workflow specification.\n\nFailure report: ${JSON.stringify(input.repair.failureReport)}\n\nPrevious agent source:\n${input.repair.previousSource}\n\nPrevious test source:\n${input.repair.previousTests}`
    : 'Generate the first implementation for this workflow.';
  return `You are generating a constrained Python agent from a confirmed typed workflow specification. ${repairInstruction}

Return only the requested structured output. Generate only deterministic decision logic supported by the specification. Any ambiguity, AI-judgment boundary, unsupported step, or approval boundary must return a safe human-review outcome. Do not invent rules, connectors, data sources, or side effects.

The generated Python is untrusted and will be AST-validated. It may import only typing and pydantic; generated tests may additionally import agent. Do not use filesystem, network, subprocesses, shell commands, dynamic imports, eval, exec, reflection, dunder access, or external dependencies. Include focused pytest tests for the declared decision and safety boundaries.

Confirmed workflow intermediate representation (the only customer workflow input):
${JSON.stringify(input.specification)}`;
}
