import { SourceIntelligence } from '../../../../features/evidence/source-intelligence';
export default async function UnderstandPage({ params }: { readonly params: Promise<{ readonly projectId: string }> }) { const { projectId } = await params; return <SourceIntelligence projectId={projectId} />; }
