import { invoiceExceptionSeedData, invoiceExceptionWorkflowPack, loadInvoiceObservationWorkspace } from '@tacit/workflow-invoice-exception';
import { ObservationWorkspace } from '../../../../features/observation/observation-workspace';
import { ProductionObservation } from '../../../../features/observation/production-observation';

export default async function ObservePage({ params }: { readonly params: Promise<{ readonly projectId: string }> }) {
  const { projectId } = await params;
  if (projectId === invoiceExceptionSeedData.project.id) return <ObservationWorkspace projectId={invoiceExceptionSeedData.project.id} workflowName={invoiceExceptionWorkflowPack.name} workspace={invoiceExceptionWorkflowPack.workspaceDefinition} panelData={loadInvoiceObservationWorkspace()} evidence={invoiceExceptionSeedData.documents.map((document) => ({ id: document.id, title: document.title }))} />;
  return <ProductionObservation projectId={projectId} />;
}
