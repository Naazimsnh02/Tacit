import type { ExtractedEvidence, ObservationSession, WorkflowEvent, WorkflowReconstruction } from '@tacit/core-schemas';
import { invoiceExceptionWorkflowPack } from '@tacit/workflow-invoice-exception';
import { WorkflowRegistry } from '@tacit/workflow-registry';
import { describe, expect, it } from 'vitest';
import { ReconstructionOutputError, reconstructWorkflow, type ReconstructionRepository } from './service';

const projectId = '11111111-1111-4111-8111-111111111111';
const sessionId = '55555555-5555-4555-8555-555555555555';
const evidenceId = '22222222-2222-4222-8222-222222222222';
const eventId = '66666666-6666-4666-8666-666666666666';
const session: ObservationSession = { id: sessionId, projectId, status: 'completed', startedAt: '2026-07-15T09:00:00.000Z', completedAt: '2026-07-15T09:02:00.000Z', narration: 'Review evidence.', createdAt: '2026-07-15T09:00:00.000Z' };
const event: WorkflowEvent = { id: eventId, observationSessionId: sessionId, source: 'user', action: 'complete_review', occurredAt: '2026-07-15T09:02:00.000Z', payload: {}, evidenceIds: [evidenceId] };
const evidence: ExtractedEvidence = { id: evidenceId, artifactId: '88888888-8888-4888-8888-888888888888', kind: 'text', content: 'SOP evidence', pageStart: 1, pageEnd: 1, timeStartMs: null, timeEndMs: null, confidence: 1, sourceArtifactVersion: 'v1', createdAt: '2026-07-15T09:00:00.000Z' };

function registry(): WorkflowRegistry {
  const value = new WorkflowRegistry();
  value.register(invoiceExceptionWorkflowPack);
  return value;
}
function repository(): ReconstructionRepository & { saved: number; rulesSaved: number } {
  return {
    saved: 0, rulesSaved: 0,
    async getProject() { return { id: projectId, workflowType: 'invoice_exception', mode: 'demo' as const }; },
    async getSession() { return session; }, async getEvents() { return [event]; }, async getEvidence() { return [evidence]; }, async nextWorkflowVersion() { return 1; },
    async saveWorkflowVersion(value) { this.saved += 1; expect(value.version).toBe(1); expect(value.modelRole).toBe('workflow_reasoning'); return { id: '77777777-7777-4777-8777-777777777777', version: value.version }; },
    async saveRules(_workflowVersionId, rules) { this.rulesSaved += 1; expect(rules[0].evidenceIds).toContain(evidenceId); },
  };
}

describe('reconstructWorkflow', () => {
  it('persists an evidence-backed workflow version from the pack fallback', async () => {
    const store = repository();
    const result = await reconstructWorkflow({ projectId, sessionId, finalDecision: 'approve', registry: registry(), repository: store });
    expect(result.version).toBe(1);
    expect(result.source).toBe('seeded_fallback');
    expect(result.reconstruction.contradictions).toHaveLength(1);
    expect(store.saved).toBe(1);
    expect(store.rulesSaved).toBe(1);
  });

  it('retries one invalid model response without persisting corrupt state', async () => {
    const store = repository();
    let calls = 0;
    const prompts: string[] = [];
    await expect(reconstructWorkflow({ projectId, sessionId, finalDecision: 'approve', registry: registry(), repository: store, model: { async reconstruct(prompt): Promise<unknown> { calls += 1; prompts.push(prompt); return { invalid: true }; } } })).rejects.toBeInstanceOf(ReconstructionOutputError);
    expect(calls).toBe(2);
    expect(prompts[0]).toContain('workflowObjective');
    expect(prompts[1]).toContain('prior response did not match');
    expect(store.saved).toBe(0);
    expect(store.rulesSaved).toBe(0);
  });

  it('persists a schema-valid model reconstruction', async () => {
    const store = repository();
    const fallback = invoiceExceptionWorkflowPack.reconstructionFallback!({ evidenceIds: [evidenceId] }) as WorkflowReconstruction;
    const result = await reconstructWorkflow({ projectId, sessionId, finalDecision: 'approve', registry: registry(), repository: store, model: { async reconstruct() { return fallback; } } });
    expect(result.source).toBe('model');
    expect(store.saved).toBe(1);
  });

  it('does not allow production reconstruction to use a seeded fallback', async () => {
    const store = repository();
    store.getProject = async () => ({ id: projectId, workflowType: 'invoice_exception', mode: 'production' });
    await expect(reconstructWorkflow({ projectId, sessionId, finalDecision: 'approve', registry: registry(), repository: store })).rejects.toBeInstanceOf(ReconstructionOutputError);
  });

  it('rejects a model claim that cites evidence outside the project', async () => {
    const store = repository();
    const fallback = invoiceExceptionWorkflowPack.reconstructionFallback!({ evidenceIds: [evidenceId] }) as WorkflowReconstruction;
    const invalid = { ...fallback, rules: [{ ...fallback.rules[0], evidenceIds: ['99999999-9999-4999-8999-999999999999'] }] };
    await expect(reconstructWorkflow({ projectId, sessionId, finalDecision: 'approve', registry: registry(), repository: store, model: { async reconstruct() { return invalid; } } })).rejects.toBeInstanceOf(ReconstructionOutputError);
    expect(store.saved).toBe(0);
  });
});
