"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { BrandLogo } from './brand-logo';
import { workspaceHref, workspaceNavigationLabels, type WorkspaceNavigationLabel, type WorkspaceNavigationState } from './workspace-navigation';

export function WorkspaceShell({ children, active = 'Overview', projectId, projectName = 'Invoice Exception Review', versionId, mode = 'demo' }: { readonly children: ReactNode; readonly active?: WorkspaceNavigationLabel; readonly projectId?: string; readonly projectName?: string; readonly versionId?: string; readonly mode?: 'demo' | 'production' }) {
  const isProduction = mode === 'production';
  const [navigation, setNavigation] = useState<WorkspaceNavigationState>({ workflowVersionId: versionId });

  useEffect(() => {
    if (!isProduction || !projectId) return;
    let activeRequest = true;
    const token = accessTokenForSession();
    if (!token) return;
    void fetch(`/api/projects/${projectId}/workspace-navigation`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const body = await response.json() as WorkspaceNavigationState;
        if (!response.ok) throw new Error();
        return body;
      })
      .then((value) => { if (activeRequest) setNavigation(value); })
      .catch(() => { /* Keep any route-provided version instead of breaking navigation on a transient read failure. */ });
    return () => { activeRequest = false; };
  }, [isProduction, projectId, versionId]);

  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="/" aria-label="Tacit home"><BrandLogo /></a><div className="project-context"><div><small>Active project</small><strong>{projectName}</strong></div><span className={`status ${isProduction ? 'status-success' : 'status-warning'}`}>{isProduction ? 'Production mode' : 'Demo mode'}</span></div><div className="sidebar-section-label">Workflow workspace</div><nav className="nav-list" aria-label="Project navigation">{workspaceNavigationLabels.map((label, index) => <a className={`nav-link${label === active ? ' active' : ''}`} aria-current={label === active ? 'page' : undefined} href={workspaceHref(label, projectId, navigation)} key={label}><span className="nav-index">{String(index + 1).padStart(2, '0')}</span>{label}</a>)}</nav><div className="sidebar-footer"><span className="sidebar-footer-dot" />{isProduction ? 'Private project evidence' : 'Synthetic, isolated demo data'}</div></aside><main className="app-main"><header className="workspace-topbar"><div className="workspace-location"><span>Control center</span><span aria-hidden="true">/</span><strong>{active}</strong></div><div className="workspace-tools"><span className="workspace-health"><span />System ready</span><span className="workspace-avatar" aria-label="Current workspace user">T</span></div></header><div className="content">{children}</div></main></div>;
}

function accessTokenForSession(): string | null {
  try { return (JSON.parse(window.sessionStorage.getItem('tacit.production.session') ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null; } catch { return null; }
}

export function PageHeader({ breadcrumb, title, description, status, actions }: { readonly breadcrumb: string; readonly title: string; readonly description: string; readonly status?: ReactNode; readonly actions?: ReactNode }) {
  return <header className="page-header"><div className="page-header-copy"><div className="breadcrumb">Tacit <span aria-hidden="true">/</span> {breadcrumb}</div><h1>{title}</h1><p className="page-description">{description}</p>{status ? <div className="page-status">{status}</div> : null}</div>{actions ? <div className="header-actions page-header-actions">{actions}</div> : null}</header>;
}
