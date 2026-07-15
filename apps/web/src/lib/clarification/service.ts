import {
  clarificationAnswerValueSchema,
  clarificationQuestionDraftSchema,
  workflowReconstructionSchema,
  type ClarificationAnswerValue,
  type ClarificationQuestion,
  type ClarificationQuestionDraft,
  type WorkflowReconstruction,
} from '@tacit/core-schemas';
import type { WorkflowRegistry } from '@tacit/workflow-registry';

export interface ClarificationRepository {
  getWorkflowVersion(id: string): Promise<{ id: string; projectId: string; version: number; specification: unknown; workflowType: string } | null>;
  getQuestion(id: string): Promise<ClarificationQuestion | null>;
  getQuestions(workflowVersionId: string): Promise<readonly ClarificationQuestion[]>;
  saveQuestions(workflowVersionId: string, questions: readonly ClarificationQuestionDraft[]): Promise<readonly ClarificationQuestion[]>;
  nextWorkflowVersion(projectId: string): Promise<number>;
  saveWorkflowVersion(value: { projectId: string; version: number; specification: WorkflowReconstruction; promptVersion: string; modelRole: string }): Promise<{ id: string; version: number }>;
  saveRules(workflowVersionId: string, rules: WorkflowReconstruction['rules']): Promise<void>;
  answerQuestion(questionId: string, answer: ClarificationAnswerValue): Promise<void>;
  saveRuleDiffs(input: { previousWorkflowVersionId: string; workflowVersionId: string; before: WorkflowReconstruction['rules']; after: WorkflowReconstruction['rules'] }): Promise<void>;
  markBuildsStale(workflowVersionId: string): Promise<void>;
}

export class ClarificationInputError extends Error {}

export function createClarificationQuestions(reconstruction: WorkflowReconstruction): ClarificationQuestionDraft[] {
  const questions: ClarificationQuestionDraft[] = [];
  for (const rule of reconstruction.rules) {
    if (rule.verificationStatus !== 'confirmed' || rule.confidence < 0.8) questions.push({
      id: `confirm_${rule.id}`, question: `Should the generated agent apply this rule: ${rule.condition}?`,
      rationale: `The rule is ${rule.verificationStatus} with ${Math.round(rule.confidence * 100)}% confidence.`, relatedRuleId: rule.id,
      evidenceIds: rule.evidenceIds, answerType: 'boolean', suggestedAnswers: [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }],
      riskIfUnanswered: 'The agent must keep this decision behind a human review boundary.',
    });
  }
  for (const contradiction of reconstruction.contradictions.filter((item) => item.requiresClarification)) questions.push({
    id: `resolve_${contradiction.id}`, question: `How should the agent resolve this conflict: ${contradiction.description}?`,
    rationale: contradiction.businessImpact, relatedRuleId: reconstruction.rules.find((rule) => rule.riskLevel === 'high')?.id ?? null,
    evidenceIds: contradiction.evidenceIds, answerType: 'free_text', suggestedAnswers: [],
    riskIfUnanswered: 'Conflicting evidence could produce an unsafe outcome.',
  });
  for (const [index, unknown] of reconstruction.unknowns.entries()) questions.push({
    id: `unknown_${index + 1}`, question: unknown, rationale: 'This unknown prevents a deterministic automation boundary.', relatedRuleId: null,
    evidenceIds: reconstruction.rules[0]?.evidenceIds ?? [], answerType: 'free_text', suggestedAnswers: [],
    riskIfUnanswered: 'The agent must escalate cases affected by this unknown.',
  });
  return questions.slice(0, 5).map((item) => clarificationQuestionDraftSchema.parse(item));
}

export async function generateClarificationQuestions(input: { workflowVersionId: string; repository: ClarificationRepository }): Promise<readonly ClarificationQuestion[]> {
  const workflowVersion = await input.repository.getWorkflowVersion(input.workflowVersionId);
  if (!workflowVersion) throw new ClarificationInputError('Workflow version not found.');
  const existing = await input.repository.getQuestions(workflowVersion.id);
  if (existing.length) return existing;
  return input.repository.saveQuestions(workflowVersion.id, createClarificationQuestions(workflowReconstructionSchema.parse(workflowVersion.specification)));
}

export async function answerClarificationQuestion(input: { questionId: string; answer: unknown; repository: ClarificationRepository; registry: WorkflowRegistry }): Promise<{ workflowVersionId: string; version: number }> {
  const question = await input.repository.getQuestion(input.questionId);
  if (!question) throw new ClarificationInputError('Clarification question not found.');
  if (question.status !== 'open') throw new ClarificationInputError('This clarification question is already resolved.');
  const answer = validateAnswer(question, input.answer);
  const previous = await input.repository.getWorkflowVersion(question.workflowVersionId);
  if (!previous) throw new ClarificationInputError('Workflow version not found.');
  const reconstruction = workflowReconstructionSchema.parse(previous.specification);
  const draft = clarificationQuestionDraftSchema.parse(question);
  const pack = input.registry.get(previous.workflowType);
  const updated = pack.resolveClarificationAnswer
    ? pack.resolveClarificationAnswer({ reconstruction, question: draft, answer })
    : confirmRelatedRule(reconstruction, draft.relatedRuleId);
  const version = await input.repository.nextWorkflowVersion(previous.projectId);
  const workflowVersion = await input.repository.saveWorkflowVersion({ projectId: previous.projectId, version, specification: updated, promptVersion: 'clarification-answer-v1', modelRole: 'clarification' });
  await input.repository.saveRules(workflowVersion.id, updated.rules);
  await input.repository.answerQuestion(question.id, answer);
  await input.repository.saveRuleDiffs({ previousWorkflowVersionId: previous.id, workflowVersionId: workflowVersion.id, before: reconstruction.rules, after: updated.rules });
  await input.repository.markBuildsStale(previous.id);
  return { workflowVersionId: workflowVersion.id, version: workflowVersion.version };
}

function confirmRelatedRule(reconstruction: WorkflowReconstruction, relatedRuleId: string | null): WorkflowReconstruction {
  if (!relatedRuleId) return reconstruction;
  return { ...reconstruction, rules: reconstruction.rules.map((rule) => rule.id === relatedRuleId ? { ...rule, verificationStatus: 'confirmed', confidence: 1 } : rule) };
}

function validateAnswer(question: ClarificationQuestion, value: unknown): ClarificationAnswerValue {
  const answer = clarificationAnswerValueSchema.parse(value);
  if (question.answerType === 'boolean' && typeof answer !== 'boolean') throw new ClarificationInputError('This question requires a yes or no answer.');
  if (question.answerType === 'number' && typeof answer !== 'number') throw new ClarificationInputError('This question requires a numeric answer.');
  if (question.answerType === 'multi_select' && !Array.isArray(answer)) throw new ClarificationInputError('This question requires one or more selected answers.');
  if ((question.answerType === 'single_select' || question.answerType === 'free_text') && typeof answer !== 'string') throw new ClarificationInputError('This question requires a text answer.');
  if (question.answerType === 'single_select' && question.suggestedAnswers.length && !question.suggestedAnswers.some((item) => item.value === answer)) throw new ClarificationInputError('Select one of the suggested answers.');
  return answer;
}
