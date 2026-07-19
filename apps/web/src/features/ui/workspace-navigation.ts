export const workspaceNavigationLabels = ['Sources', 'Understand', 'Clarify', 'Review', 'Build', 'Test', 'Approve', 'Operate', 'Impact'] as const;
export type WorkspaceNavigationLabel = (typeof workspaceNavigationLabels)[number];
export type WorkspaceNavigationState = { readonly workflowVersionId?: string; readonly confirmedWorkflowVersionId?: string; readonly projectName?: string };

export function workspaceHref(label: WorkspaceNavigationLabel, projectId?: string, navigation: WorkspaceNavigationState = {}): string {
  const workflowVersionId = navigation.workflowVersionId;
  const buildVersionId = navigation.confirmedWorkflowVersionId;
  if (label === 'Sources') return projectId ? `/projects/${projectId}/evidence` : '/projects';
  if (!projectId) return '/';
  if (label === 'Understand') return `/projects/${projectId}/understand`;
  if (label === 'Clarify') return workflowVersionId ? `/workflow-versions/${workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}` : `/projects/${projectId}/evidence`;
  if (label === 'Review') return workflowVersionId ? `/workflow-versions/${workflowVersionId}/graph?projectId=${encodeURIComponent(projectId)}` : `/projects/${projectId}/evidence`;
  if (label === 'Build') return buildVersionId ? `/projects/${projectId}/workflow-versions/${buildVersionId}/build` : workflowVersionId ? `/workflow-versions/${workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}` : `/projects/${projectId}/evidence`;
  if (label === 'Test') return `/projects/${projectId}/evaluations`;
  if (label === 'Approve') return `/projects/${projectId}/approvals`;
  if (label === 'Operate') return `/projects/${projectId}/operate`;
  return `/projects/${projectId}/impact`;
}
