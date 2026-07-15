import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { z } from 'zod';

const createdAt = '2026-07-15T09:00:00.000Z';

export const sampleSupportWorkflowPack = defineWorkflowPack({
  id: 'customer_support_escalation', name: 'Customer Support Escalation Sample', version: '1.0.0',
  inputSchema: z.object({ ticketReference: z.string().min(1) }), outcomeSchema: z.object({ escalationRequired: z.boolean() }),
  runtimeSchema: {
    inputs: [{ name: 'ticketReference', type: 'string', required: true, description: 'Support ticket reference.' }],
    outputs: [{ name: 'escalationRequired', type: 'boolean', required: true, description: 'Whether escalation is required.' }],
  },
  workspaceDefinition: {
    panels: [
      { id: 'ticket', label: 'Ticket', kind: 'document', fields: [{ id: 'reference', label: 'Reference' }] },
      { id: 'history', label: 'History', kind: 'reference', fields: [] },
    ],
    actions: [
      { id: 'view_ticket', label: 'View ticket', eventAction: 'view_ticket', evidenceTypes: ['ticket_record'] },
      { id: 'record_escalation', label: 'Record escalation', eventAction: 'record_escalation', evidenceTypes: ['ticket_record'] },
    ],
    outcomes: [{ id: 'resolve', label: 'Resolve' }, { id: 'escalate', label: 'Escalate' }],
  },
  eventCatalog: ['view_ticket', 'record_escalation'], evidenceTypes: ['ticket_record'], supportedActions: [
    { id: 'view_ticket', label: 'View ticket', eventAction: 'view_ticket', evidenceTypes: ['ticket_record'] },
    { id: 'record_escalation', label: 'Record escalation', eventAction: 'record_escalation', evidenceTypes: ['ticket_record'] },
  ],
  approvalPolicy: { type: 'escalation_required' }, evaluationDefinition: { fixtureSet: 'sample-support' }, promptContext: 'Evaluate a support escalation.',
  seedLoader: () => ({
    project: { id: '33333333-3333-4333-8333-333333333333', name: 'Support Escalation Sample', workflowType: 'customer_support_escalation', status: 'draft', configuration: {}, createdAt, updatedAt: createdAt },
    documents: [],
    testCases: [{ id: 'bbbbbbb1-0000-4000-8000-000000000001', projectId: '33333333-3333-4333-8333-333333333333', label: 'Escalate an urgent ticket', input: { ticketReference: 'SUP-001' }, expectedOutcome: { escalationRequired: true }, evidenceIds: [], createdAt }],
    domainRecords: [{ id: 'support-rule-1', type: 'approval_rule', schemaVersion: '1.0', payload: { urgent: true } }],
  }),
});
