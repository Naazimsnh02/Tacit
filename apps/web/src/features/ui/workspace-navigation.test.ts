import { describe, expect, it } from 'vitest';
import { workspaceHref } from './workspace-navigation';

const projectId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';

describe('workspace navigation', () => {
  it('keeps a production project in its evidence-to-approval flow', () => {
    const navigation = { workflowVersionId: versionId, confirmedWorkflowVersionId: versionId };
    expect(workspaceHref('Overview', projectId, navigation)).toBe(`/projects/${projectId}/evidence`);
    expect(workspaceHref('Observe', projectId, navigation)).toBe(`/projects/${projectId}/observe`);
    expect(workspaceHref('Discover', projectId, navigation)).toBe(`/workflow-versions/${versionId}/clarify?projectId=${projectId}`);
    expect(workspaceHref('Workflow', projectId, navigation)).toBe(`/workflow-versions/${versionId}/graph?projectId=${projectId}`);
    expect(workspaceHref('Build', projectId, navigation)).toBe(`/projects/${projectId}/workflow-versions/${versionId}/build`);
    expect(workspaceHref('Test', projectId, navigation)).toBe(`/projects/${projectId}/evaluations`);
    expect(workspaceHref('Approvals', projectId, navigation)).toBe(`/projects/${projectId}/approvals`);
    expect(workspaceHref('Impact', projectId, navigation)).toBe(`/projects/${projectId}/impact`);
  });

  it('routes Build to clarification when a workflow exists but is not confirmed', () => {
    expect(workspaceHref('Build', projectId, { workflowVersionId: versionId })).toBe(`/workflow-versions/${versionId}/clarify?projectId=${projectId}`);
  });
});
