import { z } from 'zod';

export const invoiceExceptionInputSchema = z.object({
  invoiceReference: z.string().min(1),
  purchaseOrderReference: z.string().min(1),
  quantityVariancePercent: z.number(),
  deliveryConfirmed: z.boolean(),
  invoiceValue: z.number().nonnegative(),
});

export const invoiceExceptionOutcomeSchema = z.object({
  decision: z.enum(['approve', 'reject', 'request_human_review']),
  reason: z.string().min(1),
});
