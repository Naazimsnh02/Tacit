import { describe, expect, it } from 'vitest';
import { WorkflowRegistry } from '@tacit/workflow-registry';
import { invoiceExceptionWorkflowPack } from './index';

describe('invoice exception workflow pack', () => {
  it('registers through the generic workflow registry', () => {
    const registry = new WorkflowRegistry();
    registry.register(invoiceExceptionWorkflowPack);
    expect(registry.get('invoice_exception').name).toBe('Invoice Exception Review');
  });

  it('owns the configured observation panels, actions, and final outcomes', () => {
    expect(invoiceExceptionWorkflowPack.workspaceDefinition.panels.map((panel) => panel.label)).toEqual(expect.arrayContaining([
      'Invoice document', 'Purchase Order', 'Delivery Record', 'Vendor Email', 'Approval Matrix', 'SOP',
    ]));
    expect(invoiceExceptionWorkflowPack.supportedActions.map((action) => action.eventAction)).toEqual(expect.arrayContaining([
      'open_document', 'compare_values', 'check_approval_threshold', 'complete_review',
    ]));
    expect(invoiceExceptionWorkflowPack.workspaceDefinition.outcomes.map((outcome) => outcome.id)).toEqual([
      'approve', 'reject', 'escalate', 'request_information', 'manager_approval',
    ]);
  });
});
