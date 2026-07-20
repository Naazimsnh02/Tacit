import type { ClarificationAnswerValue, ClarificationQuestionDraft, WorkflowReconstruction } from '@tacit/core-schemas';

/** Seeded demo output. Domain interpretation remains with the invoice pack. */
export function createInvoiceReconstructionFallback(context: {
  readonly evidenceIds: readonly string[];
}): WorkflowReconstruction {
  const evidenceId = context.evidenceIds[0];
  if (!evidenceId) throw new Error('Invoice reconstruction requires at least one evidence record.');

  return {
    workflowObjective: 'Review an invoice exception and choose a safe disposition.',
    inputs: ['invoice', 'purchase order', 'delivery record', 'vendor email', 'approval matrix'],
    steps: [
      { id: 'review_documents', name: 'Review source records', description: 'Open the invoice and matching reference records.', type: 'action', sequence: 1, inputs: ['invoice'], outputs: ['reviewed records'], evidenceIds: [evidenceId], confidence: 0.96 },
      { id: 'compare_quantity', name: 'Compare quantities', description: 'Calculate the invoice-to-purchase-order quantity variance.', type: 'deterministic_rule', sequence: 2, inputs: ['invoice quantity', 'purchase-order quantity'], outputs: ['quantity variance'], evidenceIds: [evidenceId], confidence: 0.91 },
      { id: 'verify_delivery', name: 'Verify delivery', description: 'Confirm delivery before accepting a tolerance exception.', type: 'deterministic_rule', sequence: 3, inputs: ['delivery record'], outputs: ['delivery status'], evidenceIds: [evidenceId], confidence: 0.94 },
      { id: 'select_disposition', name: 'Select disposition', description: 'Apply the documented and observed policy boundaries.', type: 'human_decision', sequence: 4, inputs: ['comparison results', 'approval threshold'], outputs: ['final decision'], evidenceIds: [evidenceId], confidence: 0.78 },
    ],
    decisionPoints: ['Whether quantity variance is within tolerance.', 'Whether delivery is confirmed.', 'Which manager approval threshold applies.'],
    rules: [
      { id: 'quantity_tolerance', name: 'Quantity tolerance', condition: 'Quantity variance is at or below 2% and delivery is confirmed.', action: 'Approve the quantity exception.', exceptions: ['Missing delivery confirmation'], confidence: 0.9, evidenceIds: [evidenceId], verificationStatus: 'inferred', riskLevel: 'medium' },
      { id: 'manager_threshold', name: 'Manager approval threshold', condition: 'Invoice value exceeds the applicable manager threshold.', action: 'Require manager approval.', exceptions: [], confidence: 0.62, evidenceIds: [evidenceId], verificationStatus: 'unverified', riskLevel: 'high' },
    ],
    exceptions: ['Missing delivery confirmation requires a hold or escalation.', 'Possible duplicates require human review.'],
    contradictions: [{ id: 'approval_threshold_conflict', sourceA: 'SOP', sourceB: 'SME narration', description: 'The SOP threshold and the observed manager threshold differ.', businessImpact: 'Invoices may be approved without the required escalation.', severity: 'high', evidenceIds: [evidenceId], requiresClarification: true }],
    unknowns: ['Which manager approval threshold is authoritative.'],
    approvalRequirements: ['High-value invoices require manager approval until the threshold is confirmed.'],
    automationCandidates: ['Quantity comparison', 'delivery confirmation check'],
  };
}

export function resolveInvoiceClarificationAnswer(input: {
  readonly reconstruction: WorkflowReconstruction; readonly question: ClarificationQuestionDraft; readonly answer: ClarificationAnswerValue;
}): WorkflowReconstruction {
  const answer = Array.isArray(input.answer) ? input.answer.join(', ') : String(input.answer);
  const resolvesManagerThreshold = isConcreteManagerThresholdAnswer(input.question, input.answer);
  const rules = input.reconstruction.rules.map((rule) => {
    if (rule.id !== input.question.relatedRuleId && !(resolvesManagerThreshold && rule.id === 'manager_threshold')) return rule;
    if (rule.id === 'manager_threshold') {
      return {
        ...rule,
        condition: resolveManagerThresholdCondition(rule.condition, answer),
        verificationStatus: 'confirmed' as const,
        confidence: 1,
      };
    }
    return {
      ...rule,
      action: input.answer === false ? 'Require human review for this decision.' : rule.action,
      verificationStatus: 'confirmed' as const,
      confidence: 1,
    };
  });
  const resolvedContradictions = input.reconstruction.contradictions.filter((contradiction) => {
    if (resolvesManagerThreshold && isManagerThresholdConflict(contradiction.description)) return false;
    return input.question.question !== `How should the agent resolve this conflict: ${contradiction.description}?`;
  });
  const resolvedUnknowns = input.reconstruction.unknowns.filter((unknown) => {
    if (resolvesManagerThreshold && isManagerThresholdUnknown(unknown)) return false;
    return input.question.question !== unknown;
  });
  return { ...input.reconstruction, rules, contradictions: resolvedContradictions, unknowns: resolvedUnknowns };
}

function isConcreteManagerThresholdAnswer(question: ClarificationQuestionDraft, answer: ClarificationAnswerValue): boolean {
  if (typeof answer !== 'string' && typeof answer !== 'number') return false;
  if (question.relatedRuleId !== 'manager_threshold' && !isManagerThresholdUnknown(question.question)) return false;
  const value = String(answer).trim();
  return /\d/.test(value) || /\bsop\b|documented policy|\bobserved\b|\bcurrent\b|manager threshold/i.test(value);
}

function isManagerThresholdConflict(description: string): boolean {
  return /manager threshold|approval threshold/i.test(description);
}

function isManagerThresholdUnknown(unknown: string): boolean {
  return /which manager approval threshold is authoritative/i.test(unknown);
}

function resolveManagerThresholdCondition(existingCondition: string, answer: string): string {
  // A yes/no confirmation must preserve the previously inferred threshold. Free-text
  // conflict answers can select the SOP (₹300,000) or the observed threshold
  // (₹500,000), or state an explicit number.
  if (answer === 'true' || answer === 'false') return existingCondition;
  const numericThreshold = answer.replace(/[^0-9]/g, '');
  if (numericThreshold) return `Invoice value exceeds ${numericThreshold}.`;
  if (/\bsop\b|documented policy/i.test(answer)) return 'Invoice value exceeds 300000.';
  if (/\bobserved\b|\bcurrent\b|manager threshold/i.test(answer)) return 'Invoice value exceeds 500000.';
  return existingCondition;
}
