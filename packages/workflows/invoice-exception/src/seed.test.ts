import { describe, expect, it } from 'vitest';
import { invoiceExceptionSeedData, invoiceExceptionWorkflowPack } from './index';
import { invoiceExceptionInputSchema, invoiceExceptionOutcomeSchema } from './schemas';

describe('invoice exception seed data', () => {
  it('contains each required deterministic record set and ten labelled historical cases', () => {
    const recordCount = (type: string) => invoiceExceptionSeedData.domainRecords.filter((record) => record.type === type).length;
    expect(invoiceExceptionSeedData.project.workflowType).toBe('invoice_exception');
    expect(invoiceExceptionSeedData.documents).toHaveLength(1);
    expect(recordCount('invoice_record')).toBe(10);
    expect(recordCount('purchase_order_record')).toBe(10);
    expect(recordCount('delivery_record')).toBe(10);
    expect(recordCount('vendor_email')).toBe(5);
    expect(recordCount('approval_matrix')).toBe(1);
    expect(recordCount('expert_demonstration')).toBe(1);
    expect(invoiceExceptionSeedData.testCases).toHaveLength(10);
    for (const testCase of invoiceExceptionSeedData.testCases) {
      expect(testCase.label).not.toBe('');
      expect(invoiceExceptionInputSchema.safeParse(testCase.input).success).toBe(true);
      expect(invoiceExceptionOutcomeSchema.safeParse(testCase.expectedOutcome).success).toBe(true);
    }
  });

  it('exposes the same data through the workflow-pack seed loader', () => {
    expect(invoiceExceptionWorkflowPack.seedLoader()).toBe(invoiceExceptionSeedData);
  });
});
