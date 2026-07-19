import type { WorkflowPack } from '@tacit/workflow-sdk';
import type { z } from 'zod';

type RegisteredWorkflowPack = WorkflowPack<z.ZodType, z.ZodType>;

export class WorkflowRegistry {
  private readonly workflowPacks = new Map<string, RegisteredWorkflowPack>();
  private fallbackId: string | null = null;

  register(workflowPack: RegisteredWorkflowPack): void {
    if (this.workflowPacks.has(workflowPack.id)) throw new Error(`Workflow pack already registered: ${workflowPack.id}`);
    this.workflowPacks.set(workflowPack.id, workflowPack);
    // First registered pack is the process-agnostic default for unknown types.
    if (!this.fallbackId) this.fallbackId = workflowPack.id;
  }

  /** Prefer an explicit fallback (e.g. generic_process) over registration order. */
  setFallback(workflowType: string): void {
    if (!this.workflowPacks.has(workflowType)) throw new Error(`Unknown workflow pack: ${workflowType}`);
    this.fallbackId = workflowType;
  }

  get(workflowType: string): RegisteredWorkflowPack {
    const workflowPack = this.workflowPacks.get(workflowType);
    if (workflowPack) return workflowPack;
    if (this.fallbackId) {
      const fallback = this.workflowPacks.get(this.fallbackId);
      if (fallback) return fallback;
    }
    throw new Error(`Unknown workflow pack: ${workflowType}`);
  }

  list(): readonly RegisteredWorkflowPack[] {
    return [...this.workflowPacks.values()];
  }
}
