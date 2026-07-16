import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { loadInvoiceExceptionSeed } from './seed';
import { invoiceExceptionInputSchema, invoiceExceptionOutcomeSchema } from './schemas';
import { createInvoiceReconstructionFallback, resolveInvoiceClarificationAnswer } from './reconstruction';

const invoiceActions = [
  { id: 'open_document', label: 'Open document', eventAction: 'open_document', evidenceTypes: ['invoice_document'], timelineStep: 'Viewed invoice' },
  { id: 'switch_tab', label: 'Switch tab', eventAction: 'switch_tab', evidenceTypes: [], timelineStep: 'Reviewed reference evidence' },
  { id: 'compare_values', label: 'Compare values', eventAction: 'compare_values', evidenceTypes: ['invoice_document', 'purchase_order_record'], timelineStep: 'Applied tolerance rule' },
  { id: 'highlight_field', label: 'Highlight field', eventAction: 'highlight_field', evidenceTypes: ['invoice_document'], timelineStep: 'Reviewed invoice field' },
  { id: 'open_vendor_history', label: 'Open vendor history', eventAction: 'open_vendor_history', evidenceTypes: ['vendor_email'], timelineStep: 'Reviewed vendor history' },
  { id: 'read_email', label: 'Read email', eventAction: 'read_email', evidenceTypes: ['vendor_email'], timelineStep: 'Reviewed vendor email' },
  { id: 'check_approval_threshold', label: 'Check approval threshold', eventAction: 'check_approval_threshold', evidenceTypes: ['approval_matrix'], timelineStep: 'Checked approval limit' },
  { id: 'select_decision', label: 'Select decision', eventAction: 'select_decision', evidenceTypes: ['invoice_document'], timelineStep: 'Made final decision' },
  { id: 'add_note', label: 'Add note', eventAction: 'add_note', evidenceTypes: [], timelineStep: 'Captured expert narration' },
  { id: 'complete_review', label: 'Complete review', eventAction: 'complete_review', evidenceTypes: ['invoice_document'], timelineStep: 'Completed review' },
] as const;

export const invoiceExceptionWorkflowPack = defineWorkflowPack({
  id: 'invoice_exception',
  name: 'Invoice Exception Review',
  version: '1.0.0',
  inputSchema: invoiceExceptionInputSchema,
  outcomeSchema: invoiceExceptionOutcomeSchema,
  runtimeSchema: {
    inputs: [
      { name: 'invoiceReference', type: 'string', required: true, description: 'Invoice reference.' },
      { name: 'purchaseOrderReference', type: 'string', required: false, description: 'Purchase-order reference.' },
      { name: 'invoiceQuantity', type: 'number', required: true, description: 'Invoiced quantity.' },
      { name: 'purchaseOrderQuantity', type: 'number', required: false, description: 'Approved quantity.' },
      { name: 'deliveryConfirmed', type: 'boolean', required: true, description: 'Whether delivery is confirmed.' },
      { name: 'invoiceValue', type: 'number', required: true, description: 'Invoice value.' },
      { name: 'duplicateInvoice', type: 'boolean', required: true, description: 'Whether a duplicate was detected.' },
    ],
    outputs: [
      { name: 'decision', type: 'string', required: true, description: 'Safe workflow disposition.' },
      { name: 'reason', type: 'string', required: true, description: 'Evidence-backed disposition rationale.' },
    ],
  },
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
  evidenceTypes: ['invoice_sop', 'invoice_document', 'purchase_order_record', 'delivery_record', 'vendor_email', 'approval_matrix'],
  supportedEvidenceArtifactTypes: ['sop', 'document', 'spreadsheet', 'image', 'audio', 'video'],
  supportedActions: invoiceActions,
  approvalPolicy: { type: 'value_threshold', thresholdSource: 'approval_matrix' },
  evaluationDefinition: { fixtureSet: 'invoice-exception-historical-cases' },
  evaluateCase: assessInvoiceEvaluationCase,
  promptContext: 'Review invoice exceptions using workflow-specific evidence and policy.',
  reconstructionFallback: createInvoiceReconstructionFallback,
  resolveClarificationAnswer: resolveInvoiceClarificationAnswer,
  seedLoader: loadInvoiceExceptionSeed,
});

export { invoiceExceptionSeedData, loadInvoiceExceptionSeed } from './seed';
export { loadInvoiceObservationWorkspace } from './workspace';
export * from './schemas';
export { createInvoiceReconstructionFallback, resolveInvoiceClarificationAnswer } from './reconstruction';

function assessInvoiceEvaluationCase(input: {
  readonly testCase: { input: Record<string, unknown>; expectedOutcome: Record<string, unknown>; evidenceIds: readonly string[] };
  readonly actualOutcome: Record<string, unknown> | null; readonly executionError: string | null;
}) {
  const expectedDecision = input.testCase.expectedOutcome.decision;
  const actualDecision = input.actualOutcome?.decision;
  const appliedRuleIds = inferInvoiceRuleIds(input.testCase.input);
  if (input.executionError) return { matchCategory: 'execution_failure' as const, appliedRuleIds, evidenceIds: input.testCase.evidenceIds, confidence: null, failureExplanation: input.executionError, suggestedNextStep: 'Inspect the generated build output and rerun the case.' };
  if (actualDecision === expectedDecision) return { matchCategory: 'exact_match' as const, appliedRuleIds, evidenceIds: input.testCase.evidenceIds, confidence: 0.95, failureExplanation: null, suggestedNextStep: null };
  if (actualDecision === 'human_review' && ['escalate', 'escalate_to_procurement', 'manager_approval', 'reject_or_escalate'].includes(String(expectedDecision))) return { matchCategory: 'correct_escalation' as const, appliedRuleIds, evidenceIds: input.testCase.evidenceIds, confidence: 0.68, failureExplanation: null, suggestedNextStep: 'Confirm whether the review boundary can be automated safely.' };
  if (actualDecision === 'human_review' && expectedDecision === 'policy_clarification') return { matchCategory: 'needs_clarification' as const, appliedRuleIds, evidenceIds: input.testCase.evidenceIds, confidence: 0.5, failureExplanation: 'The agent stopped safely but did not identify the policy conflict.', suggestedNextStep: 'Clarify the conflicting policy and rebuild the agent.' };
  return { matchCategory: 'incorrect' as const, appliedRuleIds, evidenceIds: input.testCase.evidenceIds, confidence: 0.2, failureExplanation: `Expected ${String(expectedDecision)} but the agent returned ${String(actualDecision ?? 'no decision')}.`, suggestedNextStep: 'Review the failed case, update the relevant rule, and retain it as a regression test.' };
}

function inferInvoiceRuleIds(input: Record<string, unknown>): string[] {
  const rules: string[] = [];
  if (input.purchaseOrderQuantity == null) rules.push('purchase_order_required');
  if (input.deliveryConfirmed === false) rules.push('delivery_confirmation_required');
  if (input.duplicateInvoice === true) rules.push('duplicate_invoice_review');
  if (typeof input.invoiceValue === 'number' && input.invoiceValue > 500000) rules.push('manager_threshold');
  if (rules.length === 0) rules.push('quantity_tolerance');
  return rules;
}
