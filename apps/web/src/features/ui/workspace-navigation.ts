export const workspaceNavigationLabels = ['Overview', 'Observe', 'Discover', 'Workflow', 'Build', 'Test', 'Approvals', 'Impact'] as const;
export type WorkspaceNavigationLabel = (typeof workspaceNavigationLabels)[number];
export type WorkspaceNavigationState = { readonly workflowVersionId?: string; readonly confirmedWorkflowVersionId?: string };

export function workspaceHref(label: WorkspaceNavigationLabel, projectId?: string, navigation: WorkspaceNavigationState = {}): string {
  const workflowVersionId = navigation.workflowVersionId;
  const buildVersionId = navigation.confirmedWorkflowVersionId;
  if (label === 'Overview') return projectId ? `/projects/${projectId}/evidence` : '/demo';
  if (!projectId) return '/';
  if (label === 'Observe') return `/projects/${projectId}/observe`;
  if (label === 'Discover') return workflowVersionId ? `/workflow-versions/${workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}` : `/projects/${projectId}/observe`;
  if (label === 'Workflow') return workflowVersionId ? `/workflow-versions/${workflowVersionId}/graph?projectId=${encodeURIComponent(projectId)}` : `/projects/${projectId}/observe`;
  if (label === 'Build') return buildVersionId ? `/projects/${projectId}/workflow-versions/${buildVersionId}/build` : workflowVersionId ? `/workflow-versions/${workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}` : `/projects/${projectId}/observe`;
  return `/projects/${projectId}/${label === 'Test' ? 'evaluations' : label.toLowerCase()}`;
}
