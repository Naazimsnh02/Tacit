export type EvidenceRefreshArtifact = { readonly status: string };

/** Background refresh is needed only until the ingestion worker reaches a terminal state. */
export function hasPendingEvidenceProcessing(artifacts: readonly EvidenceRefreshArtifact[]): boolean {
  return artifacts.some(({ status }) => status === 'uploading' || status === 'queued' || status === 'processing');
}

export function hasReadyEvidence(artifacts: readonly { readonly status: string; readonly scanStatus: string }[], extractionCount: number): boolean {
  return extractionCount > 0 && artifacts.some(({ status, scanStatus }) => status === 'ready' && scanStatus === 'clean');
}
