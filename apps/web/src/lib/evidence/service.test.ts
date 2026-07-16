import { describe, expect, it } from 'vitest';
import { EvidenceUploadError, buildEvidenceStorageKey, sanitizeFilename, uploadRequestSchema, validateFileSignature, validateUpload } from './service';

const valid = { evidenceType: 'sop' as const, filename: 'Review SOP.pdf', mediaType: 'application/pdf', byteSize: 200, checksumSha256: 'a'.repeat(64), processingConsent: true };
describe('evidence upload validation', () => {
  it('sanitizes an upload into an artifact-scoped tenant storage key', () => {
    expect(buildEvidenceStorageKey('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '../Q3: review.pdf')).toBe('11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/source/Q3- review.pdf');
  });
  it('requires a matching permitted MIME type, extension, checksum, and consent', () => {
    expect(validateUpload(uploadRequestSchema.parse(valid))).toMatchObject({ filename: 'Review SOP.pdf', extension: '.pdf' });
    expect(() => validateUpload(uploadRequestSchema.parse({ ...valid, mediaType: 'video/mp4' }))).toThrow(EvidenceUploadError);
    expect(uploadRequestSchema.safeParse({ ...valid, processingConsent: false }).success).toBe(false);
  });
  it('rejects spoofed PDF bytes before processing', () => {
    expect(validateFileSignature('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
    expect(validateFileSignature('application/pdf', new Uint8Array([1, 2, 3, 4]))).toBe(false);
    expect(() => sanitizeFilename('..')).toThrow(EvidenceUploadError);
  });
});
