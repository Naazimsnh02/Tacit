import type { WorkflowReconstruction } from '@tacit/core-schemas';
import { describe, expect, it } from 'vitest';
import { applyWorkflowPatch, createWorkflowClaims, planSourceDerivedTests, recommendDeploymentMode, validateSourceInterpretation } from './service';

const evidenceId = '11111111-1111-4111-8111-111111111111';
const workflow: WorkflowReconstruction = { workflowObjective: 'Review a record', inputs: ['record'], steps: [{ id: 'review', name: 'Review', description: 'Review the source.', type: 'action', sequence: 1, inputs: ['record'], outputs: ['decision'], evidenceIds: [evidenceId], confidence: .9 }], decisionPoints: ['decision'], rules: [{ id: 'rule', name: 'Policy', condition: 'record is complete', action: 'recommend', exceptions: [], confidence: .9, evidenceIds: [evidenceId], verificationStatus: 'confirmed', riskLevel: 'low' }], exceptions: [], contradictions: [], unknowns: [], approvalRequirements: [], automationCandidates: ['review'] };

describe('AI-first product services', () => {
  it('keeps insight citations inside durable project evidence', () => {
    const extraction = { id: evidenceId, artifactId: '22222222-2222-4222-8222-222222222222', kind: 'text' as const, content: 'Policy', pageStart: 1, pageEnd: 1, timeStartMs: null, timeEndMs: null, confidence: 1, sourceArtifactVersion: 'v1', createdAt: '2026-07-18T00:00:00.000Z' };
    expect(validateSourceInterpretation({ sourceClass: 'policy', summary: 'A policy', entities: [], facts: [{ statement: 'Record is reviewed.', extractionIds: [evidenceId], confidence: .9 }] }, [extraction]).facts).toHaveLength(1);
    expect(() => validateSourceInterpretation({ sourceClass: 'policy', summary: 'A policy', entities: [], facts: [{ statement: 'No', extractionIds: ['33333333-3333-4333-8333-333333333333'], confidence: .9 }] }, [extraction])).toThrow('outside this project');
  });
  it('projects source-grounded claims and conservative test/readiness plans', () => {
    const claims = createWorkflowClaims({ workflowVersionId: '44444444-4444-4444-8444-444444444444', reconstruction: workflow, evidenceIds: new Set([evidenceId]), now: new Date('2026-07-18T00:00:00.000Z'), createId: () => '55555555-5555-4555-8555-555555555555' });
    expect(claims).toHaveLength(2); expect(planSourceDerivedTests(workflow, 2)).toHaveLength(2);
    expect(recommendDeploymentMode({ reconstruction: workflow, replayAccuracy: .97, unresolvedClarifications: 0, openContradictions: 0 }).mode).toBe('low_risk_automatic');
  });
  it('only applies validated workflow-contract patches', () => {
    expect(applyWorkflowPatch(workflow, [{ op: 'replace', path: '/workflowObjective', value: 'Review a validated record' }]).workflowObjective).toContain('validated');
    expect(() => applyWorkflowPatch(workflow, [{ op: 'replace', path: '/projectId', value: 'nope' }])).toThrow('outside the workflow contract');
  });
});
