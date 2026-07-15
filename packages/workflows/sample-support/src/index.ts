import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { z } from 'zod';

export const sampleSupportWorkflowPack = defineWorkflowPack({
  id: 'sample-support', name: 'Customer Support Escalation Sample', version: '0.1.0',
  inputSchema: z.object({ ticketReference: z.string().min(1) }), outcomeSchema: z.object({ escalationRequired: z.boolean() }),
  workspaceDefinition: [{ id: 'ticket', label: 'Ticket' }, { id: 'history', label: 'History' }],
  eventCatalog: ['view_ticket', 'record_escalation'], evidenceTypes: ['ticket_record'], supportedActions: ['resolve', 'escalate'],
  approvalPolicy: { type: 'escalation_required' }, evaluationDefinition: { fixtureSet: 'sample-support' }, promptContext: 'Evaluate a support escalation.',
});
