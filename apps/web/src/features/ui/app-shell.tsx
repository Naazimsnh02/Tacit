import type { ReactNode } from 'react';

const labels = ['Overview', 'Observe', 'Discover', 'Workflow', 'Build', 'Test', 'Approvals', 'Impact'] as const;
type NavigationLabel = (typeof labels)[number];

function hrefFor(label: NavigationLabel, projectId?: string, versionId?: string): string {
  if (label === 'Overview') return '/demo';
  if (!projectId) return '/';
  if (label === 'Observe' || label === 'Discover') return `/projects/${projectId}/observe`;
  if (label === 'Workflow') return versionId ? `/workflow-versions/${versionId}/graph` : `/projects/${projectId}/observe`;
  if (label === 'Build') return versionId ? `/projects/${projectId}/workflow-versions/${versionId}/build` : `/projects/${projectId}/observe`;
  return `/projects/${projectId}/${label === 'Test' ? 'evaluations' : label.toLowerCase()}`;
}

export function WorkspaceShell({ children, active = 'Overview', projectId, projectName = 'Invoice Exception Review', versionId }: { readonly children: ReactNode; readonly active?: NavigationLabel; readonly projectId?: string; readonly projectName?: string; readonly versionId?: string }) {
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="/"><span className="brand-mark">T</span><span>Tacit</span></a><div className="project-context"><small>Active project</small><strong>{projectName}</strong><span className="status status-warning">Demo mode</span></div><nav className="nav-list" aria-label="Project navigation">{labels.map((label, index) => <a className={`nav-link${label === active ? ' active' : ''}`} aria-current={label === active ? 'page' : undefined} href={hrefFor(label, projectId, versionId)} key={label}><span className="nav-index">{String(index + 1).padStart(2, '0')}</span>{label}</a>)}</nav><div className="sidebar-footer">Synthetic, isolated demo data</div></aside><main className="app-main"><div className="content">{children}</div></main></div>;
}

export function PageHeader({ breadcrumb, title, description, status, actions }: { readonly breadcrumb: string; readonly title: string; readonly description: string; readonly status?: ReactNode; readonly actions?: ReactNode }) {
  return <header className="page-header"><div className="page-header-copy"><div className="breadcrumb">Tacit / {breadcrumb}</div><h1>{title}</h1><p className="page-description">{description}</p>{status ? <div style={{ marginTop: 12 }}>{status}</div> : null}</div>{actions ? <div className="header-actions">{actions}</div> : null}</header>;
}
