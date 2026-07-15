import { describe, expect, it } from 'vitest';
import { WorkflowRegistry } from '@tacit/workflow-registry';
import { invoiceExceptionWorkflowPack } from './index';

describe('invoice exception workflow pack', () => {
  it('registers through the generic workflow registry', () => {
    const registry = new WorkflowRegistry();
    registry.register(invoiceExceptionWorkflowPack);
    expect(registry.get('invoice-exception').name).toBe('Invoice Exception Review');
  });
});
