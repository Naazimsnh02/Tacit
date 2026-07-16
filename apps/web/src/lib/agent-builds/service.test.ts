import { describe, expect, it } from 'vitest';
import { createInvoiceReconstructionFallback } from '@tacit/workflow-invoice-exception';
import { createWorkflowRegistry } from '../workflow-packs';
import { AgentBuildInputError, AgentBuildOutputError, compileAgent, type AgentArtifactStore, type AgentBuildRepository, type AgentBuildRunner, type AgentBuildWorkspace, type CodexModel, type GeneratedTestReport, type StaticAnalysisReport } from './service';

const projectId = '11111111-1111-4111-8111-111111111111';
const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const workflowVersionId = '22222222-2222-4222-8222-222222222222';
const evidenceId = '33333333-3333-4333-8333-333333333333';

class Repository implements AgentBuildRepository {
  logs: { stage: string; message: string }[] = []; completed: { artifactPath: string; manifest: Record<string, unknown> } | null = null; failed: string | null = null; repairs: { summary: string }[] = []; running = false;
  constructor(private readonly reconstruction = confirmedReconstruction(), private readonly confirmed = true) {}
  async getWorkflowVersion() { return { id: workflowVersionId, projectId, organizationId, version: 2, workflowType: 'invoice_exception', mode: 'production' as const, specification: this.reconstruction }; }
  async hasWorkflowConfirmation() { return this.confirmed; }
  async getTestCaseIds() { return ['44444444-4444-4444-8444-444444444444']; }
  async createBuild() { return { id: '55555555-5555-4555-8555-555555555555' }; }
  async markBuildRunning() { this.running = true; }
  async saveLog(input: { stage: string; message: string }) { this.logs.push(input); }
  async completeBuild(input: { artifactPath: string; manifest: Record<string, unknown> }) { this.completed = input; }
  async failBuild(input: { reason: string }) { this.failed = input.reason; }
  async createRepairProposal(input: { summary: string }) { this.repairs.push(input); }
}

class Workspace implements AgentBuildWorkspace { files: Record<string, string> = {}; async write(_path: string, files: Readonly<Record<string, string>>) { this.files = { ...files }; } }
class Store implements AgentArtifactStore { files: Record<string, string> = {}; path = ''; async persist(path: string, files: Readonly<Record<string, string>>) { this.path = path; this.files = { ...files }; return { artifactPath: path, files: Object.keys(files) }; } }
class Model implements CodexModel {
  calls = 0;
  constructor(private readonly responses = [safeGeneration()]) {}
  async generate() { const response = this.responses[this.calls++] ?? safeGeneration(); return response; }
}
class Runner implements AgentBuildRunner {
  calls = 0;
  constructor(private readonly reports: readonly StaticAnalysisReport[]) {}
  async validate() { return this.reports[this.calls++] ?? { valid: true, errors: [], filesChecked: 2 }; }
  async test(): Promise<GeneratedTestReport> { return { status: 'passed', exitCode: 0, durationMs: 8, stdout: '1 passed', stderr: '', passedTests: 1, failedTests: 0 }; }
}

function safeGeneration() { return { agentSource: "def evaluate(payload):\n    return {'decision': 'human_review', 'reason': 'approval boundary'}\n", testSource: "from agent import evaluate\n\ndef test_review_boundary():\n    assert evaluate({})['decision'] == 'human_review'\n", summary: 'Generated a safe review-boundary agent.', responseId: 'resp_test', model: 'configured-codex-model', usage: { total_tokens: 10 } }; }
function confirmedReconstruction() { const reconstruction = createInvoiceReconstructionFallback({ evidenceIds: [evidenceId] }); return { ...reconstruction, rules: reconstruction.rules.map((rule) => ({ ...rule, verificationStatus: 'confirmed' as const })) }; }

describe('agent compilation', () => {
  it('compiles only a confirmed production workflow through Codex, tests it, and awaits promotion', async () => {
    const repository = new Repository(); const workspace = new Workspace(); const store = new Store();
    const result = await compileAgent({ projectId, workflowVersionId, registry: createWorkflowRegistry(), repository, workspace, artifactStore: store, runner: new Runner([{ valid: true, errors: [], filesChecked: 2 }]), model: new Model() });
    expect(result.artifactPath).toBe(`${organizationId}/${projectId}/builds/55555555-5555-4555-8555-555555555555`);
    expect(repository.running).toBe(true); expect(repository.completed?.manifest.executionStatus).toBe('passed'); expect(repository.completed?.manifest.promotionStatus).toBe('pending');
    expect(store.files['specification.json']).toContain('approvalPolicy'); expect(store.files['dependencies.lock']).toContain('pydantic=='); expect(store.files['prompts/build.txt']).toContain('only customer workflow input');
    expect(store.files['attempts/1/test-output.json']).toContain('passed'); expect(store.files['agent.py']).toContain("human_review");
  });

  it('repairs a failed generated implementation without mutating the confirmed workflow', async () => {
    const repository = new Repository(); const store = new Store(); const model = new Model([{ ...safeGeneration(), agentSource: 'import os\n' }, safeGeneration()]);
    await compileAgent({ projectId, workflowVersionId, registry: createWorkflowRegistry(), repository, workspace: new Workspace(), artifactStore: store, runner: new Runner([{ valid: false, errors: ["agent.py:1: import 'os' is not allowed"], filesChecked: 2 }, { valid: true, errors: [], filesChecked: 2 }]), model });
    expect(model.calls).toBe(2); expect(store.files['attempts/1/validation.json']).toContain('not allowed'); expect(store.files['attempts/2/agent.py']).toContain('human_review'); expect(repository.repairs).toHaveLength(0);
  });

  it('records a repair proposal when one repair does not pass the static gate', async () => {
    const repository = new Repository(); const store = new Store();
    await expect(compileAgent({ projectId, workflowVersionId, registry: createWorkflowRegistry(), repository, workspace: new Workspace(), artifactStore: store, runner: new Runner([{ valid: false, errors: ['bad'], filesChecked: 2 }, { valid: false, errors: ['still bad'], filesChecked: 2 }]), model: new Model() })).rejects.toBeInstanceOf(AgentBuildOutputError);
    expect(repository.repairs).toHaveLength(1); expect(repository.failed).toContain('static analysis'); expect(store.files['attempts/2/validation.json']).toContain('still bad');
  });

  it('refuses unconfirmed workflows before queueing a build', async () => {
    const repository = new Repository(confirmedReconstruction(), false);
    await expect(compileAgent({ projectId, workflowVersionId, registry: createWorkflowRegistry(), repository, workspace: new Workspace(), artifactStore: new Store(), runner: new Runner([]), model: new Model() })).rejects.toBeInstanceOf(AgentBuildInputError);
    expect(repository.logs).toEqual([]);
  });
});
