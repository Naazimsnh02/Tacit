import { describe, expect, it } from 'vitest';
import { workspaceHref } from './workspace-navigation';
const projectId = 'project-1'; const versionId = 'version-1';
describe('workspace navigation', () => {
  it('uses the AI-first labels while preserving existing route targets', () => {
    const navigation = { workflowVersionId: versionId, confirmedWorkflowVersionId: versionId };
    expect(workspaceHref('Sources', projectId, navigation)).toBe(`/projects/${projectId}/evidence`);
    expect(workspaceHref('Understand', projectId, navigation)).toBe(`/projects/${projectId}/understand`);
    expect(workspaceHref('Clarify', projectId, navigation)).toBe(`/workflow-versions/${versionId}/clarify?projectId=${projectId}`);
    expect(workspaceHref('Review', projectId, navigation)).toBe(`/workflow-versions/${versionId}/graph?projectId=${projectId}`);
    expect(workspaceHref('Build', projectId, navigation)).toBe(`/projects/${projectId}/workflow-versions/${versionId}/build`);
    expect(workspaceHref('Test', projectId, navigation)).toBe(`/projects/${projectId}/evaluations`);
    expect(workspaceHref('Approve', projectId, navigation)).toBe(`/projects/${projectId}/approvals`);
    expect(workspaceHref('Operate', projectId, navigation)).toBe(`/projects/${projectId}/operate`);
  });
  it('keeps build gated on a confirmed workflow version', () => { expect(workspaceHref('Build', projectId, { workflowVersionId: versionId })).toBe(`/workflow-versions/${versionId}/clarify?projectId=${projectId}`); });
});
