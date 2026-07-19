export const evidenceTypes = ['sop', 'document', 'spreadsheet', 'image', 'audio', 'video'] as const;

export type EvidenceType = (typeof evidenceTypes)[number];

const extension = (filename: string): string => filename.toLowerCase().split('.').pop() ?? '';

/** Suggests a safe starting type while leaving every selected source editable. */
export function suggestedEvidenceType(file: Pick<File, 'name' | 'type'>): EvidenceType {
  const mediaType = file.type.toLowerCase();
  const fileExtension = extension(file.name);
  if (mediaType.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(fileExtension)) return 'video';
  if (mediaType.startsWith('audio/') || ['mp3', 'm4a', 'wav'].includes(fileExtension)) return 'audio';
  if (mediaType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension)) return 'image';
  if (['csv', 'xls', 'xlsx'].includes(fileExtension) || mediaType.includes('spreadsheet') || mediaType.includes('excel')) return 'spreadsheet';
  if (/\b(sop|standard[ _-]?operating[ _-]?procedure)\b/i.test(file.name)) return 'sop';
  return 'document';
}

/** Keeps the evidence list useful without rendering an entire source segment inline. */
export function previewText(content: string, maximumLength = 280): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, maximumLength).trimEnd()}…`;
}
