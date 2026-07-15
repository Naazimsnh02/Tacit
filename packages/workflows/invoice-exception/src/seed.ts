import { workflowPackSeedSchema, type WorkflowPackSeed } from '@tacit/workflow-sdk';
import { z } from 'zod';
import demoSeed from '../fixtures/demo-seed.json';
import {
  approvalMatrixSchema,
  deliveryRecordSchema,
  expertDemonstrationSchema,
  invoiceExceptionInputSchema,
  invoiceExceptionOutcomeSchema,
  invoiceRecordSchema,
  purchaseOrderRecordSchema,
  vendorEmailSchema,
} from './schemas';

const invoiceDomainRecordSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('invoice_record'), schemaVersion: z.literal('1.0'), payload: invoiceRecordSchema }),
  z.object({ id: z.string(), type: z.literal('purchase_order_record'), schemaVersion: z.literal('1.0'), payload: purchaseOrderRecordSchema }),
  z.object({ id: z.string(), type: z.literal('delivery_record'), schemaVersion: z.literal('1.0'), payload: deliveryRecordSchema }),
  z.object({ id: z.string(), type: z.literal('vendor_email'), schemaVersion: z.literal('1.0'), payload: vendorEmailSchema }),
  z.object({ id: z.string(), type: z.literal('approval_matrix'), schemaVersion: z.literal('1.0'), payload: approvalMatrixSchema }),
  z.object({ id: z.string(), type: z.literal('expert_demonstration'), schemaVersion: z.literal('1.0'), payload: expertDemonstrationSchema }),
]);

const invoiceSeedDataSchema = workflowPackSeedSchema.superRefine((value, context) => {
  if (value.project.workflowType !== 'invoice_exception') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invoice seed project must use invoice_exception.' });
  }
  value.domainRecords.forEach((record, index) => {
    const parsed = invoiceDomainRecordSchema.safeParse(record);
    if (!parsed.success) context.addIssue({ code: z.ZodIssueCode.custom, path: ['domainRecords', index], message: parsed.error.message });
  });
  value.testCases.forEach((testCase, index) => {
    const input = invoiceExceptionInputSchema.safeParse(testCase.input);
    const outcome = invoiceExceptionOutcomeSchema.safeParse(testCase.expectedOutcome);
    if (!input.success) context.addIssue({ code: z.ZodIssueCode.custom, path: ['testCases', index, 'input'], message: input.error.message });
    if (!outcome.success) context.addIssue({ code: z.ZodIssueCode.custom, path: ['testCases', index, 'expectedOutcome'], message: outcome.error.message });
  });
});

export const invoiceExceptionSeedData: WorkflowPackSeed = invoiceSeedDataSchema.parse(demoSeed);

export function loadInvoiceExceptionSeed(): WorkflowPackSeed {
  return invoiceExceptionSeedData;
}
