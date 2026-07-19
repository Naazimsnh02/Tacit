import type { ReconstructedRule, ReconstructedWorkflowStep, WorkflowReconstruction } from '@tacit/core-schemas';

export type AutomationRecommendation = 'automate' | 'ai_prepare_human_approve' | 'human_required' | 'unsupported';
export type WorkflowGraphNodeType = 'start' | 'action' | 'deterministic_rule' | 'ai_judgment' | 'human_decision' | 'approval' | 'escalation' | 'end';
export type WorkflowGraphEdgeType = 'default' | 'conditional' | 'failure' | 'escalation' | 'approval';

export interface WorkflowGraphNodeDetail {
  readonly description: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly rule: string | null;
  readonly confidence: number | null;
  readonly evidenceIds: readonly string[];
  readonly evidence?: readonly { readonly id: string; readonly label: string }[];
  readonly automationRecommendation: AutomationRecommendation;
  readonly riskLevel: 'low' | 'medium' | 'high' | null;
  readonly verificationStatus: 'inferred' | 'confirmed' | 'unverified' | null;
}

export interface WorkflowGraphNode {
  readonly id: string;
  readonly type: WorkflowGraphNodeType;
  readonly label: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly detail: WorkflowGraphNodeDetail;
}

export interface WorkflowGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: WorkflowGraphEdgeType;
  readonly label?: string;
}

export interface WorkflowGraph {
  readonly nodes: readonly WorkflowGraphNode[];
  readonly edges: readonly WorkflowGraphEdge[];
}

export function classifyRuleAutomation(rule: ReconstructedRule): AutomationRecommendation {
  if (rule.riskLevel === 'high' || rule.verificationStatus === 'unverified') return 'human_required';
  if (rule.verificationStatus !== 'confirmed' || rule.confidence < 0.8) return 'ai_prepare_human_approve';
  return 'automate';
}

export function classifyStepAutomation(step: ReconstructedWorkflowStep, rules: readonly ReconstructedRule[]): AutomationRecommendation {
  if (step.type === 'human_decision' || step.type === 'approval' || step.type === 'escalation') return 'human_required';
  if (step.type === 'ai_judgment') return 'ai_prepare_human_approve';
  const relatedRules = rules.filter((rule) => sharesTerms(step, rule));
  if (relatedRules.some((rule) => classifyRuleAutomation(rule) === 'human_required')) return 'human_required';
  if (relatedRules.some((rule) => classifyRuleAutomation(rule) === 'ai_prepare_human_approve')) return 'ai_prepare_human_approve';
  return step.confidence >= 0.8 && step.evidenceIds.length ? 'automate' : 'unsupported';
}

export function createWorkflowGraph(reconstruction: WorkflowReconstruction): WorkflowGraph {
  const steps = [...reconstruction.steps].sort((left, right) => left.sequence - right.sequence);
  const nodes: WorkflowGraphNode[] = [terminalNode('start', 'Start', 0)];
  const edges: WorkflowGraphEdge[] = [];

  for (const [index, step] of steps.entries()) {
    nodes.push({
      id: `step:${step.id}`, type: step.type, label: step.name, position: { x: 0, y: 150 + index * 170 },
      detail: { description: step.description, inputs: step.inputs, outputs: step.outputs, rule: null, confidence: step.confidence, evidenceIds: step.evidenceIds, automationRecommendation: classifyStepAutomation(step, reconstruction.rules), riskLevel: null, verificationStatus: null },
    });
    edges.push({ id: `sequence:${index}`, source: index ? `step:${steps[index - 1]?.id}` : 'start', target: `step:${step.id}`, type: 'default' });
  }

  for (const [index, rule] of reconstruction.rules.entries()) {
    const recommendation = classifyRuleAutomation(rule);
    const attachedStep = steps.filter((step) => step.type === 'deterministic_rule')[index] ?? steps.at(-1);
    if (!attachedStep) continue;
    const id = `rule:${rule.id}`;
    nodes.push({ id, type: ruleNodeType(recommendation), label: rule.name, position: { x: 360, y: 150 + steps.indexOf(attachedStep) * 170 }, detail: { description: rule.action, inputs: [], outputs: [rule.action], rule: rule.condition, confidence: rule.confidence, evidenceIds: rule.evidenceIds, automationRecommendation: recommendation, riskLevel: rule.riskLevel, verificationStatus: rule.verificationStatus } });
    edges.push({ id: `rule-input:${rule.id}`, source: `step:${attachedStep.id}`, target: id, type: ruleEdgeType(recommendation), label: recommendation === 'automate' ? 'applies' : 'review boundary' });
  }

  const endY = 150 + steps.length * 170;
  nodes.push(terminalNode('end', 'End', endY));
  edges.push({ id: 'complete', source: steps.length ? `step:${steps.at(-1)?.id}` : 'start', target: 'end', type: 'default' });
  return { nodes, edges };
}

function terminalNode(id: 'start' | 'end', label: string, y: number): WorkflowGraphNode {
  return { id, type: id, label, position: { x: 0, y }, detail: { description: id === 'start' ? 'Workflow entry point.' : 'Workflow completed.', inputs: [], outputs: [], rule: null, confidence: null, evidenceIds: [], automationRecommendation: 'automate', riskLevel: null, verificationStatus: null } };
}

function ruleNodeType(recommendation: AutomationRecommendation): WorkflowGraphNodeType {
  if (recommendation === 'automate') return 'deterministic_rule';
  if (recommendation === 'ai_prepare_human_approve') return 'ai_judgment';
  if (recommendation === 'human_required') return 'approval';
  return 'escalation';
}

function ruleEdgeType(recommendation: AutomationRecommendation): WorkflowGraphEdgeType {
  if (recommendation === 'human_required') return 'approval';
  if (recommendation === 'unsupported') return 'escalation';
  return 'conditional';
}

function sharesTerms(step: ReconstructedWorkflowStep, rule: ReconstructedRule): boolean {
  const terms = `${step.name} ${step.description}`.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3);
  const ruleText = `${rule.name} ${rule.condition} ${rule.action}`.toLowerCase();
  return terms.some((term) => ruleText.includes(term));
}
