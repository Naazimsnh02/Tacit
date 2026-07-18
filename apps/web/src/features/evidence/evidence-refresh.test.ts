import { describe, expect, it } from 'vitest';
import { hasPendingEvidenceProcessing, hasReadyEvidence } from './evidence-refresh';

describe('hasPendingEvidenceProcessing', () => {
  it.each(['uploading', 'queued', 'processing'])('continues refreshing while an artifact is %s', (status) => {
    expect(hasPendingEvidenceProcessing([{ status }])).toBe(true);
  });

  it('stops refreshing after every artifact reaches a terminal state', () => {
    expect(hasPendingEvidenceProcessing([{ status: 'ready' }, { status: 'failed' }, { status: 'deleted' }])).toBe(false);
  });

  it('allows observation only once a clean artifact has produced evidence', () => {
    expect(hasReadyEvidence([{ status: 'ready', scanStatus: 'clean' }], 1)).toBe(true);
    expect(hasReadyEvidence([{ status: 'ready', scanStatus: 'clean' }], 0)).toBe(false);
    expect(hasReadyEvidence([{ status: 'processing', scanStatus: 'clean' }], 1)).toBe(false);
  });
});
