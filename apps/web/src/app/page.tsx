import { invoiceExceptionSeedData, invoiceExceptionWorkflowPack, loadInvoiceObservationWorkspace } from '@tacit/workflow-invoice-exception';
import { ObservationWorkspace } from '../features/observation/observation-workspace';

export default function HomePage() {
  return <ObservationWorkspace
    projectId={invoiceExceptionSeedData.project.id}
    workflowName={invoiceExceptionWorkflowPack.name}
    workspace={invoiceExceptionWorkflowPack.workspaceDefinition}
    panelData={loadInvoiceObservationWorkspace()}
    evidence={invoiceExceptionSeedData.documents.map((document) => ({ id: document.id, title: document.title }))}
  />;
}
