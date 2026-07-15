import { z } from 'zod';

export const invoiceExceptionInputSchema = z.object({
  invoiceReference: z.string().min(1),
  purchaseOrderReference: z.string().min(1).nullable(),
  invoiceQuantity: z.number().nonnegative(),
  purchaseOrderQuantity: z.number().nonnegative().nullable(),
  invoiceUnitPrice: z.number().nonnegative(),
  purchaseOrderUnitPrice: z.number().nonnegative().nullable(),
  deliveryConfirmed: z.boolean(),
  invoiceValue: z.number().nonnegative(),
  duplicateInvoice: z.boolean(),
  emailApproval: z.enum(['none', 'unconditional', 'conditional']),
});

export const invoiceExceptionDecisionSchema = z.enum([
  'approve',
  'escalate',
  'escalate_to_procurement',
  'request_more_information',
  'hold',
  'reject_or_escalate',
  'manager_approval',
  'human_review',
  'policy_clarification',
]);
export const invoiceExceptionOutcomeSchema = z.object({
  decision: invoiceExceptionDecisionSchema,
  reason: z.string().min(1),
});

export const invoiceRecordSchema = z.object({
  reference: z.string().min(1), purchaseOrderReference: z.string().nullable(), vendor: z.string().min(1),
  quantity: z.number().nonnegative(), unitPrice: z.number().nonnegative(), value: z.number().nonnegative(),
  duplicate: z.boolean(),
});
export const purchaseOrderRecordSchema = z.object({
  reference: z.string().min(1), quantity: z.number().nonnegative(), unitPrice: z.number().nonnegative(),
});
export const deliveryRecordSchema = z.object({ reference: z.string().min(1), confirmed: z.boolean() });
export const vendorEmailSchema = z.object({ reference: z.string().min(1), subject: z.string().min(1), body: z.string().min(1) });
export const approvalMatrixSchema = z.object({ managerApprovalThreshold: z.number().positive(), sopThreshold: z.number().positive() });
export const expertDemonstrationSchema = z.object({
  invoiceReference: z.string().min(1), narration: z.string().min(1), finalDecision: invoiceExceptionDecisionSchema,
});
