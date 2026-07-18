import { createHash } from 'node:crypto';
import { z } from 'zod';
import { workflowReconstructionSchema, workflowSpecificationSchema, type WorkflowReconstruction, type WorkflowSpecification } from '@tacit/core-schemas';
import { agentCompilationPromptVersion, createAgentCompilationPrompt } from '@tacit/prompts';
import type { WorkflowRegistry } from '@tacit/workflow-registry';

export const buildStages = ['Queued', 'Reading workflow specification', 'Generating implementation', 'Running static analysis', 'Running generated tests', 'Repairing generated implementation', 'Persisting immutable artifacts', 'Awaiting promotion'] as const;

export const codexGenerationSchema = z.object({ agentSource: z.string().min(1).max(128 * 1024), testSource: z.string().min(1).max(128 * 1024), summary: z.string().min(1).max(4000) });
export type CodexGeneration = z.infer<typeof codexGenerationSchema> & { readonly responseId: string | null; readonly model: string; readonly usage: unknown };

export interface AgentBuildRepository {
  getWorkflowVersion(id: string, projectId: string): Promise<{ id: string; projectId: string; organizationId: string; version: number; workflowType: string; mode: 'production' | 'demo'; specification: unknown } | null>;
  hasWorkflowConfirmation(input: { workflowVersionId: string; projectId: string }): Promise<boolean>;
  getTestCaseIds(projectId: string): Promise<readonly string[]>;
  createBuild(input: { projectId: string; workflowVersionId: string; requestedBy: string | null }): Promise<{ id: string }>;
  markBuildRunning(agentBuildId: string): Promise<void>;
  saveLog(input: { agentBuildId: string; stage: string; message: string }): Promise<void>;
  completeBuild(input: { agentBuildId: string; artifactPath: string; manifest: Record<string, unknown> }): Promise<void>;
  failBuild(input: { agentBuildId: string; reason: string; manifest: Record<string, unknown> }): Promise<void>;
  createRepairProposal(input: { agentBuildId: string; kind: 'repair_proposal' | 'clarification'; summary: string; details: Record<string, unknown> }): Promise<void>;
}

export interface AgentBuildWorkspace { write(buildPath: string, files: Readonly<Record<string, string>>): Promise<void>; }
export interface AgentArtifactStore { persist(buildPath: string, files: Readonly<Record<string, string>>): Promise<{ artifactPath: string; files: readonly string[] }>; }
export interface StaticAnalysisReport { readonly valid: boolean; readonly errors: readonly string[]; readonly filesChecked: number; }
export interface GeneratedTestReport { readonly status: 'passed' | 'failed' | 'timed_out'; readonly exitCode: number | null; readonly durationMs: number; readonly stdout: string; readonly stderr: string; readonly passedTests: number; readonly failedTests: number; }
export interface AgentBuildRunner { validate(buildId: string): Promise<StaticAnalysisReport>; test(buildId: string): Promise<GeneratedTestReport>; }
export interface CodexModel { generate(prompt: string): Promise<CodexGeneration>; }

export class AgentBuildInputError extends Error {}
export class AgentBuildOutputError extends Error {}

export async function compileAgent(input: {
  projectId: string; workflowVersionId: string; requestedBy?: string | null; registry: WorkflowRegistry; repository: AgentBuildRepository; workspace: AgentBuildWorkspace; artifactStore: AgentArtifactStore; runner: AgentBuildRunner; model?: CodexModel;
  onProgress?: (event: { stage: string; message: string }) => void;
}): Promise<{ buildId: string; specification: WorkflowSpecification; artifactPath: string; promotionStatus: 'pending' }> {
  const version = await input.repository.getWorkflowVersion(input.workflowVersionId, input.projectId);
  if (!version) throw new AgentBuildInputError('Workflow version not found for this project.');
  if (version.mode !== 'production') throw new AgentBuildInputError('Codex compilation is available only for confirmed production workflows.');
  const reconstruction = workflowReconstructionSchema.safeParse(version.specification);
  if (!reconstruction.success) throw new AgentBuildInputError('The workflow version does not contain a valid confirmed workflow.');
  if (reconstruction.data.rules.some((rule) => rule.verificationStatus !== 'confirmed')) throw new AgentBuildInputError('Resolve and confirm every workflow rule before building an agent.');
  if (!await input.repository.hasWorkflowConfirmation({ workflowVersionId: version.id, projectId: version.projectId })) throw new AgentBuildInputError('An SME must confirm rules, contradictions, automation boundaries, and approval policies before building an agent.');
  if (!input.model) throw new AgentBuildInputError('Agent compilation is unavailable until the configured model provider is available.');

  const build = await input.repository.createBuild({ projectId: input.projectId, workflowVersionId: version.id, requestedBy: input.requestedBy ?? null });
  const progress = async (stage: string, message: string) => { await input.repository.saveLog({ agentBuildId: build.id, stage, message }); input.onProgress?.({ stage, message }); };
  const artifactPath = `${version.organizationId}/${version.projectId}/builds/${build.id}`;
  const testCaseIds = await input.repository.getTestCaseIds(input.projectId);
  const specification = createWorkflowSpecification({ workflowVersionId: version.id, version: version.version, reconstruction: reconstruction.data, workflowPack: input.registry.get(version.workflowType), testCaseIds });
  const buildPrompt = createAgentCompilationPrompt({ specification, repair: null });
  const artifactFiles: Record<string, string> = { 'specification.json': `${JSON.stringify(specification, null, 2)}\n`, 'dependencies.lock': 'pydantic==2.10.6\n', 'prompts/build.txt': buildPrompt };

  try {
    await progress(buildStages[0], 'Build is queued and ready for the scoped compiler workspace.');
    await input.repository.markBuildRunning(build.id);
    await progress(buildStages[1], 'Validated the confirmed typed workflow IR; raw evidence was not sent to Codex.');
    let generation = await input.model.generate(buildPrompt);
    await progress(buildStages[2], 'Codex generated deterministic decision code and focused tests.');
    let attempt = 1;
    let reports = await validateAndTest({ buildId: build.id, buildPath: artifactPath, generation, workspace: input.workspace, runner: input.runner });
    addAttemptArtifacts(artifactFiles, attempt, generation, reports);
    await progress(buildStages[3], reports.staticAnalysis.valid ? 'Static analysis passed the generated source.' : 'Static analysis found generated-code violations.');
    await progress(buildStages[4], reports.tests?.status === 'passed' ? 'Generated tests passed.' : 'Generated tests did not pass.');
    if (!isSuccessful(reports)) {
      attempt += 1;
      const repairPrompt = createAgentCompilationPrompt({ specification, repair: { failureReport: reports, previousSource: generation.agentSource, previousTests: generation.testSource } });
      artifactFiles['prompts/repair.txt'] = repairPrompt;
      await progress(buildStages[5], 'Codex is repairing the failed generated implementation without changing the confirmed workflow.');
      generation = await input.model.generate(repairPrompt);
      reports = await validateAndTest({ buildId: build.id, buildPath: artifactPath, generation, workspace: input.workspace, runner: input.runner });
      addAttemptArtifacts(artifactFiles, attempt, generation, reports);
    }
    const manifest = createManifest({ specification, generation, reports, artifactFiles, artifactPath });
    artifactFiles['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
    artifactFiles['agent.py'] = generation.agentSource;
    artifactFiles['test_agent.py'] = generation.testSource;
    await progress(buildStages[6], 'Persisting immutable source, prompts, dependency lock, provenance, and test outputs.');
    await input.artifactStore.persist(artifactPath, artifactFiles);
    if (!isSuccessful(reports)) {
      const summary = reports.staticAnalysis.valid ? 'Generated tests still failed after one Codex repair attempt.' : 'Generated code still failed static analysis after one Codex repair attempt.';
      await input.repository.createRepairProposal({ agentBuildId: build.id, kind: 'repair_proposal', summary, details: { reports, artifactPath } });
      await input.repository.failBuild({ agentBuildId: build.id, reason: summary, manifest });
      throw new AgentBuildOutputError(`${summary} A repair proposal was recorded; the confirmed workflow was not changed.`);
    }
    await input.repository.completeBuild({ agentBuildId: build.id, artifactPath, manifest });
    await progress(buildStages[7], 'Build passed required gates and is awaiting an explicit promotion decision.');
    return { buildId: build.id, specification, artifactPath, promotionStatus: 'pending' };
  } catch (error) {
    if (error instanceof AgentBuildOutputError) throw error;
    const reason = error instanceof Error ? error.message : 'Agent compilation failed.';
    await input.repository.failBuild({ agentBuildId: build.id, reason, manifest: { artifactPath, promptVersion: agentCompilationPromptVersion, status: 'failed_before_artifact_persistence' } });
    throw new AgentBuildOutputError(reason);
  }
}

async function validateAndTest(input: { buildId: string; buildPath: string; generation: CodexGeneration; workspace: AgentBuildWorkspace; runner: AgentBuildRunner }): Promise<{ staticAnalysis: StaticAnalysisReport; tests: GeneratedTestReport | null }> {
  await input.workspace.write(input.buildPath, { 'agent.py': input.generation.agentSource, 'test_agent.py': input.generation.testSource, 'dependencies.lock': 'pydantic==2.10.6\n' });
  const staticAnalysis = await input.runner.validate(input.buildId);
  return { staticAnalysis, tests: staticAnalysis.valid ? await input.runner.test(input.buildId) : null };
}

function isSuccessful(reports: { staticAnalysis: StaticAnalysisReport; tests: GeneratedTestReport | null }): boolean { return reports.staticAnalysis.valid && reports.tests?.status === 'passed'; }

function addAttemptArtifacts(target: Record<string, string>, attempt: number, generation: CodexGeneration, reports: { staticAnalysis: StaticAnalysisReport; tests: GeneratedTestReport | null }): void {
  target[`attempts/${attempt}/agent.py`] = generation.agentSource;
  target[`attempts/${attempt}/test_agent.py`] = generation.testSource;
  target[`attempts/${attempt}/generation.json`] = `${JSON.stringify({ summary: generation.summary, responseId: generation.responseId, model: generation.model, usage: generation.usage }, null, 2)}\n`;
  target[`attempts/${attempt}/validation.json`] = `${JSON.stringify(reports.staticAnalysis, null, 2)}\n`;
  target[`attempts/${attempt}/test-output.json`] = `${JSON.stringify(reports.tests, null, 2)}\n`;
}

function createManifest(input: { specification: WorkflowSpecification; generation: CodexGeneration; reports: { staticAnalysis: StaticAnalysisReport; tests: GeneratedTestReport | null }; artifactFiles: Readonly<Record<string, string>>; artifactPath: string }): Record<string, unknown> {
  return {
    artifactPath: input.artifactPath, specificationFile: 'specification.json', entrypoint: 'agent.py', tests: 'test_agent.py', dependencyLock: 'dependencies.lock', promptVersion: agentCompilationPromptVersion,
    model: { id: input.generation.model, responseId: input.generation.responseId, usage: input.generation.usage }, summary: input.generation.summary,
    staticAnalysis: input.reports.staticAnalysis, generatedTests: input.reports.tests, executionStatus: isSuccessful(input.reports) ? 'passed' : 'failed', promotionStatus: 'pending',
    files: Object.entries(input.artifactFiles).map(([path, content]) => ({ path, sha256: createHash('sha256').update(content).digest('hex') })),
    workflowSpecificationDigest: createHash('sha256').update(JSON.stringify(input.specification)).digest('hex'),
  };
}

function createWorkflowSpecification(input: { workflowVersionId: string; version: number; reconstruction: WorkflowReconstruction; workflowPack: { name: string; runtimeSchema: { inputs: readonly { name: string; type: 'string' | 'number' | 'boolean' | 'object' | 'array'; required: boolean; description: string }[]; outputs: readonly { name: string; type: 'string' | 'number' | 'boolean' | 'object' | 'array'; required: boolean; description: string }[] }; approvalPolicy: unknown }; testCaseIds: readonly string[] }): WorkflowSpecification {
  const approvalPolicy = input.workflowPack.approvalPolicy;
  if (!approvalPolicy || typeof approvalPolicy !== 'object' || Array.isArray(approvalPolicy)) throw new AgentBuildInputError('Workflow pack approval policy must be an object.');
  return workflowSpecificationSchema.parse({ name: input.workflowPack.name, version: String(input.version), description: input.reconstruction.workflowObjective, workflowVersionId: input.workflowVersionId, inputs: input.workflowPack.runtimeSchema.inputs, steps: input.reconstruction.steps.map((step) => ({ id: step.id, title: step.name, description: step.description, boundary: step.type === 'approval' || step.type === 'human_decision' ? 'human_approval' : step.type === 'ai_judgment' ? 'ai_judgment' : 'deterministic', evidenceIds: step.evidenceIds })), rules: input.reconstruction.rules.map((rule) => ({ id: rule.id, name: rule.name, description: rule.name, condition: rule.condition, action: rule.action, exceptions: rule.exceptions, riskLevel: rule.riskLevel, evidenceIds: rule.evidenceIds, deterministic: rule.riskLevel === 'low' || rule.riskLevel === 'medium' })), approvalPolicy, escalationPolicy: { conditions: [...input.reconstruction.approvalRequirements, ...input.reconstruction.exceptions] }, outputSchema: input.workflowPack.runtimeSchema.outputs, auditPolicy: { evidenceRequired: true, retainDecisionTrace: true }, testCaseIds: input.testCaseIds });
}
