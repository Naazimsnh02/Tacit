import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { loadInvoiceExceptionSeed } from './seed';
import { invoiceExceptionInputSchema, invoiceExceptionOutcomeSchema } from './schemas';

export const invoiceExceptionWorkflowPack = defineWorkflowPack({
  id: 'invoice_exception',
  name: 'Invoice Exception Review',
  version: '1.0.0',
  inputSchema: invoiceExceptionInputSchema,
  outcomeSchema: invoiceExceptionOutcomeSchema,
  workspaceDefinition: [{ id: 'review', label: 'Review' }, { id: 'evidence', label: 'Evidence' }],
  eventCatalog: ['view_invoice', 'compare_purchase_order', 'confirm_delivery', 'record_decision'],
  evidenceTypes: ['invoice_document', 'purchase_order_record', 'delivery_record', 'vendor_email', 'approval_matrix'],
  supportedActions: ['approve', 'escalate', 'request_human_review'],
  approvalPolicy: { type: 'value_threshold', thresholdSource: 'approval_matrix' },
  evaluationDefinition: { fixtureSet: 'invoice-exception-historical-cases' },
  promptContext: 'Review invoice exceptions using workflow-specific evidence and policy.',
  seedLoader: loadInvoiceExceptionSeed,
});

export { invoiceExceptionSeedData, loadInvoiceExceptionSeed } from './seed';
export * from './schemas';
