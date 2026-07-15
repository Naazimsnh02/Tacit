import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { invoiceExceptionInputSchema, invoiceExceptionOutcomeSchema } from './schemas';

export const invoiceExceptionWorkflowPack = defineWorkflowPack({
  id: 'invoice-exception',
  name: 'Invoice Exception Review',
  version: '0.1.0',
  inputSchema: invoiceExceptionInputSchema,
  outcomeSchema: invoiceExceptionOutcomeSchema,
  workspaceDefinition: [
    { id: 'review', label: 'Review' },
    { id: 'evidence', label: 'Evidence' },
  ],
  eventCatalog: ['view_invoice', 'compare_purchase_order', 'confirm_delivery', 'record_decision'],
  evidenceTypes: ['invoice_document', 'purchase_order_record', 'delivery_record'],
  supportedActions: ['approve', 'reject', 'request_human_review'],
  approvalPolicy: { type: 'value_threshold' },
  evaluationDefinition: { fixtureSet: 'invoice-exception' },
  promptContext: 'Review invoice exceptions using workflow-specific evidence and policy.',
});

export { invoiceExceptionInputSchema, invoiceExceptionOutcomeSchema } from './schemas';
