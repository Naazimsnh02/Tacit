import { describe, expect, it, vi } from 'vitest';
import type { EvidenceArtifact } from '@tacit/core-schemas';
import { ingestEvidence } from './ingestion';

const artifact: EvidenceArtifact = { id: '11111111-1111-4111-8111-111111111111', projectId: '22222222-2222-4222-8222-222222222222', organizationId: '33333333-3333-4333-8333-333333333333', evidenceType: 'video', filename: 'review.mp4', displayName: 'review.mp4', mediaType: 'video/mp4', byteSize: 100, checksumSha256: 'a'.repeat(64), storageKey: 'org/project/artifact/source/review.mp4', storageVersion: 'version-1', status: 'queued', scanStatus: 'pending', processingConsentAt: '2026-07-16T00:00:00.000Z', retentionExpiresAt: null, failureReason: null, createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z' };

describe('evidence ingestion worker', () => {
  it('scans before persisting timestamp-cited normalized evidence', async () => {
    const order: string[] = []; const saveExtractions = vi.fn(async () => { order.push('save'); });
    await ingestEvidence({ artifact, scanner: { scan: async () => { order.push('scan'); return { status: 'clean' }; } }, extractor: { extract: async () => { order.push('extract'); return [{ kind: 'transcript', content: 'Delivery is confirmed.', pageStart: null, pageEnd: null, timeStartMs: 14_000, timeEndMs: 17_000, confidence: 0.92 }]; } }, repository: { markBlocked: vi.fn(), markProcessing: async () => { order.push('processing'); }, saveExtractions, markReady: async () => { order.push('ready'); }, retryOrFail: vi.fn() } });
    expect(order).toEqual(['scan', 'processing', 'extract', 'save', 'ready']);
    expect(saveExtractions).toHaveBeenCalledWith(artifact.id, 'version-1', expect.arrayContaining([expect.objectContaining({ timeStartMs: 14_000, timeEndMs: 17_000 })]));
  });
  it('does not extract blocked evidence', async () => {
    const extract = vi.fn(); const blocked = vi.fn();
    await ingestEvidence({ artifact, scanner: { scan: async () => ({ status: 'blocked', reason: 'Scanner detected malicious content.' }) }, extractor: { extract }, repository: { markBlocked: blocked, markProcessing: vi.fn(), saveExtractions: vi.fn(), markReady: vi.fn(), retryOrFail: vi.fn() } });
    expect(blocked).toHaveBeenCalledWith(artifact.id, 'Scanner detected malicious content.'); expect(extract).not.toHaveBeenCalled();
  });
});
