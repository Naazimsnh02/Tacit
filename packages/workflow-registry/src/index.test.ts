import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineWorkflowPack } from '@tacit/workflow-sdk';
import { WorkflowRegistry } from './index';

const samplePack = defineWorkflowPack({ id: 'sample', name: 'Sample', version: '1.0.0', inputSchema: z.object({}), outcomeSchema: z.object({}), workspaceDefinition: [], eventCatalog: [], evidenceTypes: [], supportedActions: [], approvalPolicy: {}, evaluationDefinition: {}, promptContext: '' });

describe('WorkflowRegistry', () => {
  it('loads registered workflow packs without domain knowledge', () => {
    const registry = new WorkflowRegistry();
    registry.register(samplePack);
    expect(registry.get('sample')).toBe(samplePack);
  });
});
