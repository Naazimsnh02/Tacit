import { OperatingWorkspace } from '../../../../features/operations/operating-workspace';
export default async function OperatePage({ params }: { readonly params: Promise<{ readonly projectId: string }> }) { const { projectId } = await params; return <OperatingWorkspace projectId={projectId} />; }
