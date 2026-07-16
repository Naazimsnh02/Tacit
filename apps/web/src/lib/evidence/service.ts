import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { evidenceArtifactTypeSchema } from '@tacit/core-schemas';

const megabyte = 1024 * 1024;

export const uploadRequestSchema = z.object({
  evidenceType: evidenceArtifactTypeSchema,
  filename: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(160),
  byteSize: z.number().int().positive(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  processingConsent: z.literal(true),
  retentionDays: z.number().int().min(1).max(3650).optional(),
});

export const completeUploadSchema = z.object({ checksumSha256: z.string().regex(/^[a-f0-9]{64}$/) });

type UploadPolicy = { readonly extensions: readonly string[]; readonly mimeTypes: readonly string[]; readonly maxBytes: number };
const policies: Record<z.infer<typeof evidenceArtifactTypeSchema>, UploadPolicy> = {
  sop: { extensions: ['.pdf', '.docx', '.txt', '.md'], mimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'], maxBytes: 50 * megabyte },
  document: { extensions: ['.pdf', '.docx', '.txt', '.md'], mimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'], maxBytes: 50 * megabyte },
  spreadsheet: { extensions: ['.csv', '.xlsx'], mimeTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], maxBytes: 50 * megabyte },
  image: { extensions: ['.png', '.jpg', '.jpeg', '.webp'], mimeTypes: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 25 * megabyte },
  audio: { extensions: ['.mp3', '.m4a', '.wav', '.webm'], mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'], maxBytes: 250 * megabyte },
  video: { extensions: ['.mp4', '.mov', '.webm'], mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'], maxBytes: 500 * megabyte },
};

export class EvidenceUploadError extends Error {}

export function sanitizeFilename(filename: string): string {
  const printable = Array.from(filename.normalize('NFKC')).filter((character) => (character.codePointAt(0) ?? 0) >= 32).join('');
  const normalized = printable.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  const safe = normalized.replace(/[^a-zA-Z0-9._ -]/g, '-').replace(/-+/g, '-').replace(/^[-. ]+|[-. ]+$/g, '');
  if (!safe || safe === '.' || safe === '..') throw new EvidenceUploadError('Choose a filename containing letters or numbers.');
  return safe.slice(0, 180);
}

export function validateUpload(input: z.infer<typeof uploadRequestSchema>): { readonly filename: string; readonly extension: string } {
  const filename = sanitizeFilename(input.filename); const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const policy = policies[input.evidenceType];
  if (!policy.extensions.includes(extension)) throw new EvidenceUploadError('This file extension is not allowed for the selected evidence type.');
  if (!policy.mimeTypes.includes(input.mediaType.toLowerCase())) throw new EvidenceUploadError('This file type is not allowed for the selected evidence type.');
  if (input.byteSize > policy.maxBytes) throw new EvidenceUploadError(`This file exceeds the ${Math.floor(policy.maxBytes / megabyte)} MB limit for the selected evidence type.`);
  return { filename, extension };
}

export function buildEvidenceStorageKey(organizationId: string, projectId: string, artifactId: string, filename: string): string {
  return `${organizationId}/${projectId}/${artifactId}/source/${sanitizeFilename(filename)}`;
}

export function createEvidenceArtifactId(): string { return randomUUID(); }

export async function sha256FromResponse(response: Response): Promise<string> {
  if (!response.ok || !response.body) throw new EvidenceUploadError('The uploaded file could not be verified.');
  const hash = createHash('sha256');
  const reader = response.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; hash.update(value); }
  return hash.digest('hex');
}

export async function inspectUploadedResponse(response: Response): Promise<{ readonly checksumSha256: string; readonly signature: Uint8Array; readonly storageVersion: string | null }> {
  if (!response.ok || !response.body) throw new EvidenceUploadError('The uploaded file could not be verified.');
  const hash = createHash('sha256'); const signature: number[] = []; const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    hash.update(value); for (const byte of value) if (signature.length < 16) signature.push(byte);
  }
  return { checksumSha256: hash.digest('hex'), signature: new Uint8Array(signature), storageVersion: response.headers.get('etag') ?? response.headers.get('x-amz-version-id') };
}

/** Rejects obvious spoofed uploads before a scanner or extractor can consume them. */
export function validateFileSignature(mediaType: string, bytes: Uint8Array): boolean {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (mediaType === 'application/pdf') return starts(0x25, 0x50, 0x44, 0x46);
  if (mediaType.includes('openxmlformats') || mediaType === 'application/vnd.ms-excel') return starts(0x50, 0x4b, 0x03, 0x04);
  if (mediaType === 'image/png') return starts(0x89, 0x50, 0x4e, 0x47);
  if (mediaType === 'image/jpeg') return starts(0xff, 0xd8, 0xff);
  if (mediaType === 'image/webp') return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (mediaType === 'video/mp4' || mediaType === 'audio/mp4') return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  if (mediaType === 'video/webm' || mediaType === 'audio/webm') return starts(0x1a, 0x45, 0xdf, 0xa3);
  if (mediaType === 'audio/mpeg') return starts(0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (mediaType === 'audio/wav') return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
  return true;
}
