import { extractedEvidenceSchema, type EvidenceArtifact, type ExtractedEvidence } from '@tacit/core-schemas';

export type MalwareScanResult = { readonly status: 'clean' } | { readonly status: 'blocked'; readonly reason: string };
export interface EvidenceScanner { scan(artifact: EvidenceArtifact): Promise<MalwareScanResult>; }
export interface EvidenceExtractor { extract(artifact: EvidenceArtifact): Promise<readonly Omit<ExtractedEvidence, 'id' | 'artifactId' | 'sourceArtifactVersion' | 'createdAt'>[]>; }
export interface EvidenceIngestionRepository {
  markBlocked(artifactId: string, reason: string): Promise<void>;
  markProcessing(artifactId: string): Promise<void>;
  saveExtractions(artifactId: string, sourceArtifactVersion: string, extractions: readonly Omit<ExtractedEvidence, 'id' | 'artifactId' | 'sourceArtifactVersion' | 'createdAt'>[]): Promise<void>;
  markReady(artifactId: string): Promise<void>;
  retryOrFail(artifactId: string, error: Error): Promise<void>;
}

/**
 * Worker orchestration only: adapters supply virus scanning, PDF/DOCX/CSV extraction,
 * OCR, transcription, and video-frame sampling. Nothing is extracted before a clean scan.
 */
export async function ingestEvidence(input: { artifact: EvidenceArtifact; scanner: EvidenceScanner; extractor: EvidenceExtractor; repository: EvidenceIngestionRepository }): Promise<void> {
  const { artifact, scanner, extractor, repository } = input;
  if (artifact.status !== 'queued' || artifact.scanStatus !== 'pending') throw new Error('Only queued, unscanned evidence may be ingested.');
  try {
    const scan = await scanner.scan(artifact);
    if (scan.status === 'blocked') { await repository.markBlocked(artifact.id, scan.reason); return; }
    await repository.markProcessing(artifact.id);
    const extracted = await extractor.extract(artifact);
    const normalized = extracted.map((item) => extractedEvidenceSchema.omit({ id: true, artifactId: true, sourceArtifactVersion: true, createdAt: true }).parse(item));
    await repository.saveExtractions(artifact.id, artifact.storageVersion ?? artifact.checksumSha256, normalized);
    await repository.markReady(artifact.id);
  } catch (error) { await repository.retryOrFail(artifact.id, error instanceof Error ? error : new Error('Evidence ingestion failed.')); }
}
