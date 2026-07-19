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

describe('automatic source understanding', () => {
  it('creates one system event for each source artifact and cites every ready extraction', () => {
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

  it('requires processed source evidence', () => {
    expect(() => createAutomatedUnderstandingObservation({ projectId, evidence: [] })).toThrow('Add at least one processed source');
  });
});
