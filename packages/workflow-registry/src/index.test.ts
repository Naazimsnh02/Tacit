import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { WorkflowRegistry } from './index';

const samplePack = defineWorkflowPack({ id: 'sample', name: 'Sample', version: '1.0.0', inputSchema: z.object({}), outcomeSchema: z.object({}), workspaceDefinition: { panels: [], actions: [], outcomes: [] }, eventCatalog: [], evidenceTypes: [], supportedActions: [], approvalPolicy: {}, evaluationDefinition: {}, promptContext: '', seedLoader: () => ({ project: { id: '44444444-4444-4444-8444-444444444444', name: 'Sample', workflowType: 'sample', status: 'draft', configuration: {}, createdAt: '2026-07-15T09:00:00.000Z', updatedAt: '2026-07-15T09:00:00.000Z' }, documents: [], testCases: [], domainRecords: [] }) });

describe('WorkflowRegistry', () => {
  it('loads registered workflow packs without domain knowledge', () => {
    const registry = new WorkflowRegistry();
    registry.register(samplePack);
    expect(registry.get('sample')).toBe(samplePack);
  });
});
