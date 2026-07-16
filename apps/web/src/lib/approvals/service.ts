import { approvalDecisionSchema, approvalRequestSchema, type ApprovalAction, type ApprovalRequest, type ImpactMetrics } from '@tacit/core-schemas';
import { z } from 'zod';

export interface ApprovalRepository {
  list(projectId: string): Promise<readonly ApprovalRequest[]>;
  get(id: string): Promise<ApprovalRequest | null>;
  saveRequest(input: Omit<ApprovalRequest, 'id'>): Promise<ApprovalRequest>;
  saveAction(input: Omit<ApprovalAction, 'id' | 'actedAt'>): Promise<ApprovalAction>;
  updateStatus(id: string, status: ApprovalRequest['status']): Promise<void>;
  latestImpact(projectId: string): Promise<ImpactMetrics | null>;
}

export class ApprovalInputError extends Error {}

const decisionInputSchema = z.object({ decision: approvalDecisionSchema, comment: z.string().trim().max(2_000).optional(), approver: z.string().trim().min(1).max(160).default('Demo approver') });

export async function createApprovalRequest(repository: ApprovalRepository, input: Omit<ApprovalRequest, 'id'>) {
  return approvalRequestSchema.parse(await repository.saveRequest(approvalRequestSchema.omit({ id: true }).parse(input)));
}

export async function recordApprovalDecision(repository: ApprovalRepository, approvalId: string, rawInput: unknown, actor?: { readonly id: string; readonly displayName: string }) {
  const input = decisionInputSchema.parse(rawInput);
  const request = await repository.get(approvalId);
  if (!request) throw new ApprovalInputError('Approval request was not found.');
  if (request.status !== 'pending') throw new ApprovalInputError('This approval request has already been resolved.');
  const action = await repository.saveAction({ approvalRequestId: approvalId, decision: input.decision, comment: input.comment ?? null, approver: actor?.displayName ?? input.approver, actorId: actor?.id ?? null });
  if (input.decision === 'approved' || input.decision === 'rejected') await repository.updateStatus(approvalId, input.decision);
  return action;
}
