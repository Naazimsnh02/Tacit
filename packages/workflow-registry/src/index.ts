import type { WorkflowPack } from '@tacit/workflow-sdk';
import type { z } from 'zod';

type RegisteredWorkflowPack = WorkflowPack<z.ZodType, z.ZodType>;

export class WorkflowRegistry {
  private readonly workflowPacks = new Map<string, RegisteredWorkflowPack>();

  register(workflowPack: RegisteredWorkflowPack): void {
    if (this.workflowPacks.has(workflowPack.id)) throw new Error(`Workflow pack already registered: ${workflowPack.id}`);
    this.workflowPacks.set(workflowPack.id, workflowPack);
  }

  get(workflowType: string): RegisteredWorkflowPack {
    const workflowPack = this.workflowPacks.get(workflowType);
    if (!workflowPack) throw new Error(`Unknown workflow pack: ${workflowType}`);
    return workflowPack;
  }

  list(): readonly RegisteredWorkflowPack[] {
    return [...this.workflowPacks.values()];
  }
}
