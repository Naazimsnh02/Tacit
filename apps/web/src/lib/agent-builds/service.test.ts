import { describe, expect, it } from 'vitest';
import { createInvoiceReconstructionFallback } from '@tacit/workflow-invoice-exception';
import { createWorkflowRegistry } from '../workflow-packs';
import { AgentBuildInputError, compileAgent, type AgentArtifactWriter, type AgentBuildRepository } from './service';

const projectId = '11111111-1111-4111-8111-111111111111';
const workflowVersionId = '22222222-2222-4222-8222-222222222222';
const evidenceId = '33333333-3333-4333-8333-333333333333';

class Repository implements AgentBuildRepository {
  logs: { stage: string; message: string }[] = [];
  completed: { artifactPath: string; manifest: Record<string, unknown> } | null = null;
  failed: string | null = null;
  constructor(private readonly reconstruction = createInvoiceReconstructionFallback({ evidenceIds: [evidenceId] })) {}
  async getWorkflowVersion() { return { id: workflowVersionId, projectId, version: 2, workflowType: 'invoice_exception', specification: this.reconstruction }; }
  async getTestCaseIds() { return ['44444444-4444-4444-8444-444444444444']; }
  async createBuild() { return { id: '55555555-5555-4555-8555-555555555555' }; }
  async saveLog(input: { stage: string; message: string }) { this.logs.push(input); }
  async completeBuild(input: { artifactPath: string; manifest: Record<string, unknown> }) { this.completed = input; }
  async failBuild(input: { reason: string }) { this.failed = input.reason; }
}

class Writer implements AgentArtifactWriter {
  path = ''; files: Readonly<Record<string, string>> = {};
  async write(path: string, files: Readonly<Record<string, string>>) { this.path = path; this.files = files; }
}

describe('agent compilation', () => {
  it('compiles a confirmed workflow into constrained runtime artifacts and persisted progress', async () => {
    const confirmed = createInvoiceReconstructionFallback({ evidenceIds: [evidenceId] });
    const repository = new Repository({ ...confirmed, rules: confirmed.rules.map((rule) => ({ ...rule, verificationStatus: 'confirmed' as const })) });
    const writer = new Writer();
    const result = await compileAgent({ projectId, workflowVersionId, registry: createWorkflowRegistry(), repository, writer });
    expect(result.artifactPath).toBe(`generated/${projectId}/55555555-5555-4555-8555-555555555555`);
    expect(result.specification.inputs.some((field) => field.name === 'deliveryConfirmed')).toBe(true);
    expect(writer.files['specification.json']).toContain('approvalPolicy');
    expect(writer.files['specification.yaml']).toContain('testCaseIds');
    expect(writer.files['agent.py']).toContain('delivery confirmation');
    expect(writer.files['agent.py']).toContain("'decision': 'manager_approval'");
    expect(writer.files['agent.py']).toContain("'decision': 'escalate_to_procurement'");
    expect(writer.files['test_agent.py']).toContain('test_quantity_tolerance_requires_delivery_confirmation');
    expect(repository.logs.map((log) => log.stage)).toContain('Build complete');
    expect(repository.completed?.manifest.executionStatus).toBe('not_run');
  });

  it('refuses to compile inferred rules and leaves no generated artifact', async () => {
    const repository = new Repository();
    const writer = new Writer();
    await expect(compileAgent({ projectId, workflowVersionId, registry: createWorkflowRegistry(), repository, writer })).rejects.toBeInstanceOf(AgentBuildInputError);
    expect(writer.path).toBe('');
    expect(repository.logs).toEqual([]);
  });
});
