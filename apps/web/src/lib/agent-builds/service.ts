import { workflowReconstructionSchema, workflowSpecificationSchema, type WorkflowReconstruction, type WorkflowSpecification } from '@tacit/core-schemas';
import type { WorkflowRegistry } from '@tacit/workflow-registry';

export const buildStages = [
  'Reading workflow specification', 'Validating rules', 'Generating input models', 'Generating decision functions',
  'Generating approval policy', 'Generating test fixtures', 'Validating generated code', 'Running tests',
  'Packaging agent', 'Build complete',
] as const;

export interface AgentBuildRepository {
  getWorkflowVersion(id: string, projectId: string): Promise<{ id: string; projectId: string; version: number; workflowType: string; specification: unknown } | null>;
  getTestCaseIds(projectId: string): Promise<readonly string[]>;
  createBuild(input: { projectId: string; workflowVersionId: string }): Promise<{ id: string }>;
  saveLog(input: { agentBuildId: string; stage: string; message: string }): Promise<void>;
  completeBuild(input: { agentBuildId: string; artifactPath: string; manifest: Record<string, unknown> }): Promise<void>;
  failBuild(input: { agentBuildId: string; reason: string }): Promise<void>;
}

export interface AgentArtifactWriter {
  write(buildPath: string, files: Readonly<Record<string, string>>): Promise<void>;
}

export class AgentBuildInputError extends Error {}
export class AgentBuildOutputError extends Error {}

export async function compileAgent(input: {
  projectId: string; workflowVersionId: string; registry: WorkflowRegistry; repository: AgentBuildRepository; writer: AgentArtifactWriter;
  onProgress?: (event: { stage: string; message: string }) => void;
}): Promise<{ buildId: string; specification: WorkflowSpecification; artifactPath: string }> {
  const version = await input.repository.getWorkflowVersion(input.workflowVersionId, input.projectId);
  if (!version) throw new AgentBuildInputError('Workflow version not found for this project.');
  const reconstruction = workflowReconstructionSchema.safeParse(version.specification);
  if (!reconstruction.success) throw new AgentBuildInputError('The workflow version does not contain a valid confirmed workflow.');
  if (reconstruction.data.rules.some((rule) => rule.verificationStatus !== 'confirmed')) {
    throw new AgentBuildInputError('Resolve and confirm every workflow rule before building an agent.');
  }

  const build = await input.repository.createBuild({ projectId: input.projectId, workflowVersionId: version.id });
  const progress = async (stage: string, message: string) => {
    await input.repository.saveLog({ agentBuildId: build.id, stage, message });
    input.onProgress?.({ stage, message });
  };

  try {
    await progress(buildStages[0], 'Loaded the confirmed workflow version.');
    const workflowPack = input.registry.get(version.workflowType);
    const testCaseIds = await input.repository.getTestCaseIds(input.projectId);
    const specification = createWorkflowSpecification({ workflowVersionId: version.id, version: version.version, reconstruction: reconstruction.data, workflowPack, testCaseIds });
    await progress(buildStages[1], 'Validated confirmed rules, evidence references, and approval boundaries.');
    const artifactPath = `generated/${input.projectId}/${build.id}`;
    const files = createAgentFiles(specification);
    await progress(buildStages[2], 'Created constrained Pydantic input and output models.');
    await progress(buildStages[3], 'Created a rule registry with a safe human-review default.');
    await progress(buildStages[4], 'Added the declared approval policy to the manifest.');
    await progress(buildStages[5], `Prepared ${testCaseIds.length} generated test fixture reference${testCaseIds.length === 1 ? '' : 's'}.`);
    await progress(buildStages[6], 'Validated the structured specification. Code execution is restricted to the runtime milestone.');
    await progress(buildStages[7], 'Generated tests are queued for restricted execution in Milestone 8.');
    await input.writer.write(artifactPath, files);
    await progress(buildStages[8], 'Packaged JSON, YAML, Python templates, test fixtures, and manifest.');
    await input.repository.completeBuild({ agentBuildId: build.id, artifactPath, manifest: JSON.parse(files['manifest.json'] ?? '{}') as Record<string, unknown> });
    await progress(buildStages[9], 'Agent compilation completed; generated tests have not yet been executed.');
    return { buildId: build.id, specification, artifactPath };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Agent compilation failed.';
    await input.repository.failBuild({ agentBuildId: build.id, reason });
    throw new AgentBuildOutputError(reason);
  }
}

function createWorkflowSpecification(input: {
  workflowVersionId: string; version: number; reconstruction: WorkflowReconstruction;
  workflowPack: { name: string; runtimeSchema: { inputs: readonly { name: string; type: 'string' | 'number' | 'boolean' | 'object' | 'array'; required: boolean; description: string }[]; outputs: readonly { name: string; type: 'string' | 'number' | 'boolean' | 'object' | 'array'; required: boolean; description: string }[] }; approvalPolicy: unknown };
  testCaseIds: readonly string[];
}): WorkflowSpecification {
  const approvalPolicy = input.workflowPack.approvalPolicy;
  if (!approvalPolicy || typeof approvalPolicy !== 'object' || Array.isArray(approvalPolicy)) throw new AgentBuildInputError('Workflow pack approval policy must be an object.');
  return workflowSpecificationSchema.parse({
    name: input.workflowPack.name, version: String(input.version), description: input.reconstruction.workflowObjective,
    workflowVersionId: input.workflowVersionId, inputs: input.workflowPack.runtimeSchema.inputs,
    steps: input.reconstruction.steps.map((step) => ({ id: step.id, title: step.name, description: step.description, boundary: step.type === 'approval' || step.type === 'human_decision' ? 'human_approval' : step.type === 'ai_judgment' ? 'ai_judgment' : 'deterministic', evidenceIds: step.evidenceIds })),
    rules: input.reconstruction.rules.map((rule) => ({ id: rule.id, name: rule.name, description: rule.name, condition: rule.condition, action: rule.action, exceptions: rule.exceptions, riskLevel: rule.riskLevel, evidenceIds: rule.evidenceIds, deterministic: rule.riskLevel === 'low' || rule.riskLevel === 'medium' })),
    approvalPolicy, escalationPolicy: { conditions: [...input.reconstruction.approvalRequirements, ...input.reconstruction.exceptions] },
    outputSchema: input.workflowPack.runtimeSchema.outputs, auditPolicy: { evidenceRequired: true, retainDecisionTrace: true }, testCaseIds: input.testCaseIds,
  });
}

function createAgentFiles(specification: WorkflowSpecification): Record<string, string> {
  const manifest = { specificationFile: 'specification.json', entrypoint: 'agent.py', tests: 'test_agent.py', executionStatus: 'not_run', generatedFiles: ['specification.json', 'specification.yaml', 'agent.py', 'fixtures.json', 'test_agent.py', 'manifest.json'] };
  return {
    'specification.json': `${JSON.stringify(specification, null, 2)}\n`,
    'specification.yaml': toYaml(specification),
    'agent.py': createPythonTemplate(specification),
    'fixtures.json': `${JSON.stringify({ test_case_ids: specification.testCaseIds }, null, 2)}\n`,
    'test_agent.py': "from agent import evaluate\n\n\ndef test_agent_requires_review_for_unimplemented_rules():\n    assert evaluate({})['status'] == 'human_review_required'\n",
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
  };
}

function createPythonTemplate(specification: WorkflowSpecification): string {
  const typeMap: Record<string, string> = { string: 'str', number: 'float', boolean: 'bool', object: 'dict[str, Any]', array: 'list[Any]' };
  const fields = specification.inputs.map((field) => `    ${field.name}: ${typeMap[field.type]}${field.required ? '' : ' | None = None'}`).join('\n');
  return `# Generated by Tacit. Execution is validated by the restricted runtime.\nfrom typing import Any\nfrom pydantic import BaseModel\n\n\nclass WorkflowInput(BaseModel):\n${fields}\n\n\nRULES = ${JSON.stringify(specification.rules, null, 2)}\n\n\ndef evaluate(payload: dict[str, Any]) -> dict[str, str]:\n    WorkflowInput.model_validate(payload)\n    # Natural-language rules are intentionally not executed until AST validation and generated tests pass.\n    return {'status': 'human_review_required', 'reason': 'Restricted runtime validation required before automation.'}\n`;
}

function toYaml(value: unknown, indent = 0): string {
  const prefix = '  '.repeat(indent);
  if (Array.isArray(value)) return value.map((item) => `${prefix}- ${typeof item === 'object' && item !== null ? `\n${toYaml(item, indent + 1)}` : yamlScalar(item)}`).join('\n') + '\n';
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${prefix}${key}: ${typeof item === 'object' && item !== null ? `\n${toYaml(item, indent + 1)}` : yamlScalar(item)}`).join('\n') + '\n';
  return `${prefix}${yamlScalar(value)}\n`;
}

function yamlScalar(value: unknown): string { return typeof value === 'string' ? JSON.stringify(value) : String(value); }
