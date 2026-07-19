import { invoiceExceptionWorkflowPack } from '@tacit/workflow-invoice-exception';
import { sampleSupportWorkflowPack } from '@tacit/workflow-sample-support';
import { WorkflowRegistry } from '@tacit/workflow-registry';
import { genericProcessWorkflowPack } from './generic-process-pack';

/**
 * Process-first registry. Legacy domain packs remain registered for demo seeds
 * and older projects, but unknown workflow types resolve to the generic pack so
 * knowledge-transfer projects are never blocked by a domain schema.
 */
export function createWorkflowRegistry(): WorkflowRegistry {
  const registry = new WorkflowRegistry();
  registry.register(genericProcessWorkflowPack);
  registry.register(invoiceExceptionWorkflowPack);
  registry.register(sampleSupportWorkflowPack);
  registry.setFallback('generic_process');
  return registry;
}

export function resolveWorkflowPack(registry: WorkflowRegistry, workflowType: string) {
  try {
    return registry.get(workflowType);
  } catch {
    return registry.get('generic_process');
  }
}
