import { invoiceExceptionSeedData, invoiceExceptionWorkflowPack, loadInvoiceObservationWorkspace } from '@tacit/workflow-invoice-exception';
import { ObservationWorkspace } from '../../../../features/observation/observation-workspace';

export default async function ObservePage({ params }: { readonly params: Promise<{ readonly projectId: string }> }) {
  const { projectId } = await params;
  if (projectId !== invoiceExceptionSeedData.project.id) return <main>Demo project not found.</main>;
  return <ObservationWorkspace projectId={invoiceExceptionSeedData.project.id} workflowName={invoiceExceptionWorkflowPack.name} workspace={invoiceExceptionWorkflowPack.workspaceDefinition} panelData={loadInvoiceObservationWorkspace()} evidence={invoiceExceptionSeedData.documents.map((document) => ({ id: document.id, title: document.title }))} />;
}
