"use client";

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BrandLogo } from './brand-logo';
import { workspaceHref, workspaceNavigationLabels, type WorkspaceNavigationLabel, type WorkspaceNavigationState } from './workspace-navigation';

export function WorkspaceShell({ children, active = 'Sources', projectId, projectName: propProjectName = 'Project', versionId, mode = 'demo' }: { readonly children: ReactNode; readonly active?: WorkspaceNavigationLabel | 'Overview' | 'Observe' | 'Discover' | 'Workflow' | 'Approvals' | 'Impact'; readonly projectId?: string; readonly projectName?: string; readonly versionId?: string; readonly mode?: 'demo' | 'production' }) {
  const isProduction = mode === 'production';
  const [navigation, setNavigation] = useState<WorkspaceNavigationState>({ workflowVersionId: versionId, projectName: propProjectName });
  const displayProjectName = navigation.projectName || propProjectName;
  const [sessionInfo, setSessionInfo] = useState<{ email: string | null } | null>(null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('tacit.production.session');
      if (stored) {
        const parsed = JSON.parse(stored) as { email?: string | null };
        setSessionInfo({ email: parsed.email ?? null });
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleLogout = () => {
    try {
      window.sessionStorage.removeItem('tacit.production.session');
      window.location.assign('/projects');
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (!projectId) return;
    try {
      const cached = window.sessionStorage.getItem(`tacit.navigation.${projectId}`);
      if (cached) {
        setNavigation(JSON.parse(cached) as WorkspaceNavigationState);
      }
    } catch {
      // Ignore
    }
  }, [projectId]);

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
      .then((value) => {
        if (activeRequest) {
          setNavigation(value);
          try {
            window.sessionStorage.setItem(`tacit.navigation.${projectId}`, JSON.stringify(value));
          } catch {
            // Ignore
          }
        }
      })
      .catch(() => { /* Keep any route-provided version instead of breaking navigation on a transient read failure. */ });
    return () => { activeRequest = false; };
  }, [isProduction, projectId, versionId]);

  return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/" aria-label="Tacit home"><BrandLogo /></Link><div className="project-context"><div><small>Active project</small><strong>{displayProjectName}</strong></div></div><div className="sidebar-section-label">Workflow workspace</div><nav className="nav-list" aria-label="Project navigation">{workspaceNavigationLabels.map((label, index) => <Link className={`nav-link${label === active ? ' active' : ''}`} aria-current={label === active ? 'page' : undefined} href={workspaceHref(label, projectId, navigation)} key={label}><span className="nav-index">{String(index + 1).padStart(2, '0')}</span>{label}</Link>)}</nav>{sessionInfo?.email ? (
    <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#475467', fontWeight: 600, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span className="sidebar-footer-dot" style={{ flexShrink: 0, backgroundColor: '#37a66b', boxShadow: '0 0 0 3px #e4f6ea' }} />
        <span title={sessionInfo.email} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sessionInfo.email}
        </span>
      </div>
      <button
        className="btn btn-secondary"
        type="button"
        style={{
          minHeight: '28px',
          padding: '0 10px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#667085',
          alignSelf: 'flex-start',
          width: '100%',
          textAlign: 'center',
          cursor: 'pointer',
        }}
        onClick={handleLogout}
      >
        Sign out
      </button>
    </div>
  ) : null}</aside><main className="app-main"><header className="workspace-topbar"><div className="workspace-location"><span>Control center</span><span aria-hidden="true">/</span><strong>{active}</strong></div></header><div className="content">{children}</div></main></div>;
}

function accessTokenForSession(): string | null {
  try { return (JSON.parse(window.sessionStorage.getItem('tacit.production.session') ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null; } catch { return null; }
}

export function PageHeader({ breadcrumb, title, description, status, actions }: { readonly breadcrumb: string; readonly title: string; readonly description: string; readonly status?: ReactNode; readonly actions?: ReactNode }) {
  return <header className="page-header"><div className="page-header-copy"><div className="breadcrumb">Tacit <span aria-hidden="true">/</span> {breadcrumb}</div><h1>{title}</h1><p className="page-description">{description}</p>{status ? <div className="page-status">{status}</div> : null}</div>{actions ? <div className="header-actions page-header-actions">{actions}</div> : null}</header>;
}
