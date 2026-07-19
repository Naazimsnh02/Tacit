import type { WorkflowSpecification } from '@tacit/core-schemas';

export type ModelRole = 'workflow_reasoning' | 'event_extraction' | 'clarification' | 'evaluation' | 'explanation' | 'agent_compilation';

export const workflowReconstructionPromptVersion = 'workflow-reconstruction-v2';
export const agentCompilationPromptVersion = 'agent-compilation-v2';

const workflowReconstructionOutputContract = `Return exactly one JSON object with these required keys and no other keys: workflowObjective (string), inputs (string[]), steps (array), decisionPoints (string[]), rules (array), exceptions (string[]), contradictions (array), unknowns (string[]), approvalRequirements (string[]), automationCandidates (string[]).
Each step must contain id, name, description, type (one of action, deterministic_rule, ai_judgment, human_decision, approval, escalation), sequence (positive integer), inputs (string[]), outputs (string[]), evidenceIds (non-empty array of supplied extraction UUIDs), and confidence (0 to 1).
Each rule must contain id, name, condition, action, exceptions (string[]), confidence (0 to 1), evidenceIds (non-empty array of supplied extraction UUIDs), verificationStatus (inferred, confirmed, or unverified), and riskLevel (low, medium, or high).
Each contradiction must contain id, sourceA, sourceB, description, businessImpact, severity (low, medium, or high), evidenceIds (non-empty array of supplied extraction UUIDs), and requiresClarification (boolean). Unknowns must be strings, never objects. Use empty arrays when a category has no supported entries.`;

export function createWorkflowReconstructionPrompt(input: {
  readonly promptContext: string;
  readonly session: unknown;
  readonly events: unknown;
  readonly evidence: unknown;
  readonly sourceInsights?: unknown;
  readonly finalDecision: string | null;
}): string {
  return `Reconstruct a workflow from the supplied evidence. ${input.promptContext}\n\n${workflowReconstructionOutputContract}\n\nEvery workflow claim (steps, rules, and contradictions) must cite one or more supplied extraction IDs in evidenceIds. Do not cite event IDs, artifact IDs, or source-insight IDs. Source insights are model-produced aids, not independent evidence: use them only when their cited extraction IDs support the claim. Do not invent unsupported rules; preserve unresolved uncertainty in unknowns and route unsafe work to an approval or escalation boundary.\n\nObservation session: ${JSON.stringify(input.session)}\nEvents: ${JSON.stringify(input.events)}\nExtracted evidence with durable page/time citations: ${JSON.stringify(input.evidence)}\nCited source insights, if available: ${JSON.stringify(input.sourceInsights ?? [])}\nFinal SME decision: ${input.finalDecision ?? 'not provided'}`;
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

The runtime contract is mandatory: agent.py must define exactly \`def evaluate(payload)\`. It receives one JSON-object payload and must return a JSON-serializable dictionary that satisfies the supplied output schema. Do not expose a different function such as \`decide\` as the runtime entry point. Your pytest tests must import and exercise \`evaluate\` directly.

The generated Python is untrusted and will be AST-validated. It may import only typing and pydantic; generated tests may additionally import agent. Do not use filesystem, network, subprocesses, shell commands, dynamic imports, eval, exec, reflection, dunder access, or external dependencies. Include focused pytest tests for the declared decision and safety boundaries.

Confirmed workflow intermediate representation (the only customer workflow input):
${JSON.stringify(input.specification)}`;
}
