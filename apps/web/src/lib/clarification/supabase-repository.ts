import type { ClarificationAnswerValue, ClarificationQuestion, WorkflowReconstruction } from '@tacit/core-schemas';
import type { ClarificationRepository } from './service';

interface Row { [key: string]: unknown }

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}
function question(row: Row): ClarificationQuestion {
  return {
    id: String(row.id), workflowVersionId: String(row.workflow_version_id), question: String(row.question), rationale: String(row.rationale), status: row.status as ClarificationQuestion['status'], answer: row.answer === null ? null : String(row.answer), relatedRuleId: row.related_rule_id === null ? null : String(row.related_rule_id), evidenceIds: Array.isArray(row.evidence_ids) ? row.evidence_ids.map(String) : [], answerType: row.answer_type as ClarificationQuestion['answerType'], suggestedAnswers: Array.isArray(row.suggested_answers) ? row.suggested_answers as ClarificationQuestion['suggestedAnswers'] : [], riskIfUnanswered: String(row.risk_if_unanswered), answerValue: row.answer_value as ClarificationQuestion['answerValue'], createdAt: String(row.created_at), answeredAt: row.answered_at === null ? null : String(row.answered_at),
  };
}

export class SupabaseClarificationRepository implements ClarificationRepository {
  private readonly config = config();
  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.config.url}/rest/v1/${path}`, { ...init, headers: { apikey: this.config.key, Authorization: `Bearer ${this.config.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`Clarification persistence failed (${response.status}).`);
    const text = await response.text(); return text ? JSON.parse(text) : null;
  }
  async getWorkflowVersion(id: string) {
    const rows = await this.request(`workflow_versions?id=eq.${encodeURIComponent(id)}&select=id,project_id,version,specification,projects!inner(workflow_type)`) as Row[];
    const row = rows[0]; return row ? { id: String(row.id), projectId: String(row.project_id), version: Number(row.version), specification: row.specification, workflowType: String((row.projects as Row).workflow_type) } : null;
  }
  async getQuestion(id: string) { const rows = await this.request(`clarification_questions?id=eq.${encodeURIComponent(id)}&select=*`) as Row[]; return rows[0] ? question(rows[0]) : null; }
  async getQuestions(workflowVersionId: string) { const rows = await this.request(`clarification_questions?workflow_version_id=eq.${encodeURIComponent(workflowVersionId)}&select=*&order=created_at.asc`) as Row[]; return rows.map(question); }
  async saveQuestions(workflowVersionId: string, questions: readonly import('@tacit/core-schemas').ClarificationQuestionDraft[]) {
    if (!questions.length) return [];
    const rows = await this.request('clarification_questions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(questions.map((item) => ({ workflow_version_id: workflowVersionId, question: item.question, rationale: item.rationale, related_rule_id: item.relatedRuleId, evidence_ids: item.evidenceIds, answer_type: item.answerType, suggested_answers: item.suggestedAnswers, risk_if_unanswered: item.riskIfUnanswered, status: 'open' }))) }) as Row[];
    return rows.map(question);
  }
  async nextWorkflowVersion(projectId: string) { const rows = await this.request(`workflow_versions?project_id=eq.${encodeURIComponent(projectId)}&select=version&order=version.desc&limit=1`) as Row[]; return rows[0] ? Number(rows[0].version) + 1 : 1; }
  async saveWorkflowVersion(value: { projectId: string; version: number; specification: WorkflowReconstruction; promptVersion: string; modelRole: string }) {
    const rows = await this.request('workflow_versions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ project_id: value.projectId, version: value.version, status: 'draft', specification: value.specification, prompt_version: value.promptVersion, model_role: value.modelRole }]) }) as Row[];
    return { id: String(rows[0].id), version: Number(rows[0].version) };
  }
  async saveRules(workflowVersionId: string, rules: WorkflowReconstruction['rules']) { await this.request('decision_rules', { method: 'POST', body: JSON.stringify(rules.map((rule) => ({ workflow_version_id: workflowVersionId, title: rule.name, condition: rule.condition, outcome: rule.action, boundary: rule.riskLevel === 'high' ? 'human_approval' : 'deterministic', status: rule.verificationStatus === 'confirmed' ? 'confirmed' : 'inferred', evidence_ids: rule.evidenceIds }))) }); }
  async answerQuestion(questionId: string, answer: ClarificationAnswerValue) { await this.request(`clarification_questions?id=eq.${encodeURIComponent(questionId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'answered', answer: Array.isArray(answer) ? answer.join(', ') : String(answer), answer_value: answer, answered_at: new Date().toISOString() }) }); }
  async saveRuleDiffs(input: { previousWorkflowVersionId: string; workflowVersionId: string; before: WorkflowReconstruction['rules']; after: WorkflowReconstruction['rules'] }) {
    const before = new Map(input.before.map((rule) => [rule.id, rule]));
    const diffs = input.after.filter((rule) => JSON.stringify(before.get(rule.id)) !== JSON.stringify(rule)).map((rule) => ({ previous_workflow_version_id: input.previousWorkflowVersionId, workflow_version_id: input.workflowVersionId, rule_id: rule.id, before_rule: before.get(rule.id), after_rule: rule }));
    if (diffs.length) await this.request('workflow_rule_diffs', { method: 'POST', body: JSON.stringify(diffs) });
  }
  async markBuildsStale(workflowVersionId: string) { await this.request(`agent_builds?workflow_version_id=eq.${encodeURIComponent(workflowVersionId)}&status=in.(queued,running,succeeded)`, { method: 'PATCH', body: JSON.stringify({ status: 'stale' }) }); }
}
