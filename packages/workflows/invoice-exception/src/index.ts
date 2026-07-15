import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { loadInvoiceExceptionSeed } from './seed';
import { invoiceExceptionInputSchema, invoiceExceptionOutcomeSchema } from './schemas';

const invoiceActions = [
  { id: 'open_document', label: 'Open document', eventAction: 'open_document', evidenceTypes: ['invoice_document'] },
  { id: 'switch_tab', label: 'Switch tab', eventAction: 'switch_tab', evidenceTypes: [] },
  { id: 'compare_values', label: 'Compare values', eventAction: 'compare_values', evidenceTypes: ['invoice_document', 'purchase_order_record'] },
  { id: 'highlight_field', label: 'Highlight field', eventAction: 'highlight_field', evidenceTypes: ['invoice_document'] },
  { id: 'open_vendor_history', label: 'Open vendor history', eventAction: 'open_vendor_history', evidenceTypes: ['vendor_email'] },
  { id: 'read_email', label: 'Read email', eventAction: 'read_email', evidenceTypes: ['vendor_email'] },
  { id: 'check_approval_threshold', label: 'Check approval threshold', eventAction: 'check_approval_threshold', evidenceTypes: ['approval_matrix'] },
  { id: 'select_decision', label: 'Select decision', eventAction: 'select_decision', evidenceTypes: ['invoice_document'] },
  { id: 'add_note', label: 'Add note', eventAction: 'add_note', evidenceTypes: [] },
  { id: 'complete_review', label: 'Complete review', eventAction: 'complete_review', evidenceTypes: ['invoice_document'] },
] as const;

export const invoiceExceptionWorkflowPack = defineWorkflowPack({
  id: 'invoice_exception',
  name: 'Invoice Exception Review',
  version: '1.0.0',
  inputSchema: invoiceExceptionInputSchema,
  outcomeSchema: invoiceExceptionOutcomeSchema,
  workspaceDefinition: {
    panels: [
      { id: 'invoice', label: 'Invoice document', kind: 'document', fields: [
        { id: 'reference', label: 'Invoice number' }, { id: 'vendor', label: 'Vendor' },
        { id: 'purchaseOrderReference', label: 'Purchase-order number' }, { id: 'invoiceDate', label: 'Invoice date' },
        { id: 'quantity', label: 'Quantity' }, { id: 'unitPrice', label: 'Unit price' },
        { id: 'value', label: 'Total value' }, { id: 'tax', label: 'Tax' }, { id: 'lineItems', label: 'Line items' },
      ] },
      { id: 'purchase-order', label: 'Purchase Order', kind: 'reference', fields: [{ id: 'reference', label: 'PO number' }, { id: 'quantity', label: 'Approved quantity' }, { id: 'unitPrice', label: 'Unit price' }] },
      { id: 'delivery-record', label: 'Delivery Record', kind: 'reference', fields: [{ id: 'reference', label: 'Delivery reference' }, { id: 'confirmed', label: 'Delivery confirmed' }] },
      { id: 'vendor-email', label: 'Vendor Email', kind: 'reference', fields: [{ id: 'subject', label: 'Subject' }, { id: 'body', label: 'Message' }] },
      { id: 'approval-matrix', label: 'Approval Matrix', kind: 'reference', fields: [{ id: 'managerApprovalThreshold', label: 'Manager threshold' }, { id: 'sopThreshold', label: 'SOP threshold' }] },
      { id: 'sop', label: 'SOP', kind: 'reference', fields: [{ id: 'summary', label: 'Guidance' }] },
      { id: 'observation', label: 'Observation controls', kind: 'controls', fields: [] },
    ],
    actions: invoiceActions,
    outcomes: [
      { id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }, { id: 'escalate', label: 'Escalate' },
      { id: 'request_information', label: 'Request information' }, { id: 'manager_approval', label: 'Manager approval' },
    ],
  },
  eventCatalog: ['open_document', 'switch_tab', 'compare_values', 'highlight_field', 'open_vendor_history', 'read_email', 'check_approval_threshold', 'select_decision', 'add_note', 'complete_review'],
  evidenceTypes: ['invoice_document', 'purchase_order_record', 'delivery_record', 'vendor_email', 'approval_matrix'],
  supportedActions: invoiceActions,
  approvalPolicy: { type: 'value_threshold', thresholdSource: 'approval_matrix' },
  evaluationDefinition: { fixtureSet: 'invoice-exception-historical-cases' },
  promptContext: 'Review invoice exceptions using workflow-specific evidence and policy.',
  seedLoader: loadInvoiceExceptionSeed,
});

export { invoiceExceptionSeedData, loadInvoiceExceptionSeed } from './seed';
export { loadInvoiceObservationWorkspace } from './workspace';
export * from './schemas';
