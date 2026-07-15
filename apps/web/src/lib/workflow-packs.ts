import { invoiceExceptionWorkflowPack } from '@tacit/workflow-invoice-exception';
import { sampleSupportWorkflowPack } from '@tacit/workflow-sample-support';
import { WorkflowRegistry } from '@tacit/workflow-registry';

export function createWorkflowRegistry(): WorkflowRegistry {
  const registry = new WorkflowRegistry();
  registry.register(invoiceExceptionWorkflowPack);
  registry.register(sampleSupportWorkflowPack);
  return registry;
}
