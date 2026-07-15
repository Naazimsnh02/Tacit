import { describe, expect, it } from 'vitest';
import { WorkflowRegistry } from '@tacit/workflow-registry';
import { sampleSupportWorkflowPack } from './index';

describe('sample support workflow pack', () => {
  it('uses the same generic registration contract', () => {
    const registry = new WorkflowRegistry();
    registry.register(sampleSupportWorkflowPack);
    expect(registry.get('sample-support')).toBe(sampleSupportWorkflowPack);
  });
});
