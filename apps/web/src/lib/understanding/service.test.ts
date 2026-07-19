import type { EvidenceInsight } from '@tacit/core-schemas';
import { describe, expect, it } from 'vitest';
import { createAutomatedUnderstandingObservation } from './service';

const projectId = '11111111-1111-4111-8111-111111111111';
const artifactOne = '22222222-2222-4222-8222-222222222222';
const artifactTwo = '33333333-3333-4333-8333-333333333333';
const evidence = [
  { id: '44444444-4444-4444-8444-444444444444', artifactId: artifactOne, kind: 'text' as const, content: 'Policy', pageStart: 1, pageEnd: 1, timeStartMs: null, timeEndMs: null, confidence: 1, sourceArtifactVersion: 'version-1', createdAt: '2026-07-18T00:00:00.000Z' },
  { id: '55555555-5555-4555-8555-555555555555', artifactId: artifactOne, kind: 'spreadsheet' as const, content: 'Threshold', pageStart: null, pageEnd: null, timeStartMs: null, timeEndMs: null, confidence: 1, sourceArtifactVersion: 'version-1', createdAt: '2026-07-18T00:00:00.000Z' },
  { id: '66666666-6666-4666-8666-666666666666', artifactId: artifactTwo, kind: 'frame' as const, content: 'Review screen', pageStart: null, pageEnd: null, timeStartMs: 0, timeEndMs: 30_000, confidence: 0.8, sourceArtifactVersion: 'version-2', createdAt: '2026-07-18T00:00:00.000Z' },
];

function packageInsight(partial: Partial<EvidenceInsight> & Pick<EvidenceInsight, 'id' | 'kind' | 'content' | 'extractionIds'>): EvidenceInsight {
  return {
    projectId,
    artifactId: null,
    entityType: null,
    entityValue: null,
    confidence: 0.9,
    modelRole: 'package_synthesis',
    modelVersion: 'test-model',
    createdAt: '2026-07-18T00:00:00.000Z',
    ...partial,
  };
}

describe('automatic source understanding', () => {
  it('creates one system event for each source artifact when package synthesis is absent', () => {
    let id = 0;
    const result = createAutomatedUnderstandingObservation({ projectId, evidence, now: new Date('2026-07-18T12:00:00.000Z'), createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` });
    expect(result.session.status).toBe('completed');
    expect(result.events).toHaveLength(2);
    expect(result.events).toMatchObject([
      { source: 'system', action: 'analyze_source_material', evidenceIds: [evidence[0]?.id, evidence[1]?.id], payload: { extractionCount: 2, extractionKinds: ['text', 'spreadsheet'] } },
      { source: 'system', action: 'analyze_source_material', evidenceIds: [evidence[2]?.id], payload: { extractionCount: 1, extractionKinds: ['frame'] } },
    ]);
    expect(result.events.every((event) => event.observationSessionId === result.session.id)).toBe(true);
  });

  it('prefers ordered package synthesis steps over per-source analysis events', () => {
    let id = 0;
    const insights = [
      packageInsight({
        id: '77777777-7777-4777-8777-777777777777',
        kind: 'package_suggested_step',
        content: 'Apply refund threshold',
        entityType: 'decision',
        entityValue: '2',
        extractionIds: [evidence[0]!.id],
      }),
      packageInsight({
        id: '88888888-8888-4888-8888-888888888888',
        kind: 'package_suggested_step',
        content: 'Confirm ticket identifiers',
        entityType: 'check',
        entityValue: '1',
        extractionIds: [evidence[0]!.id, evidence[1]!.id],
      }),
      packageInsight({
        id: '99999999-9999-4999-8999-999999999999',
        kind: 'package_policy_rule',
        content: 'refundAmount > 500 → manager_approval',
        extractionIds: [evidence[0]!.id],
      }),
    ];
    const result = createAutomatedUnderstandingObservation({
      projectId,
      evidence,
      insights,
      now: new Date('2026-07-18T12:00:00.000Z'),
      createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    });
    expect(result.session.narration).toContain('synthesized 2 process step');
    expect(result.events.map((event) => event.action)).toEqual([
      'inferred_process_step',
      'inferred_process_step',
      'inferred_policy_rule',
    ]);
    expect(result.events[0]).toMatchObject({
      action: 'inferred_process_step',
      evidenceIds: [evidence[0]!.id, evidence[1]!.id],
      payload: { stepName: '1', statement: 'Confirm ticket identifiers' },
    });
    expect(result.events[1]).toMatchObject({
      action: 'inferred_process_step',
      payload: { stepName: '2', statement: 'Apply refund threshold' },
    });
  });

  it('requires processed source evidence', () => {
    expect(() => createAutomatedUnderstandingObservation({ projectId, evidence: [] })).toThrow('Add at least one processed source');
  });
});
