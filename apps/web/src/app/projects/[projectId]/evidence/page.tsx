import { EvidenceIntake } from '../../../../features/evidence/evidence-intake';

export default async function EvidencePage({ params }: { readonly params: Promise<{ readonly projectId: string }> }) {
  const { projectId } = await params;
  return <EvidenceIntake projectId={projectId} />;
}
