'use client';
import { useEffect, useState } from 'react';
import { ImpactDashboard } from '../../../../features/impact/impact-dashboard';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
export default function ImpactPage({ params }: { readonly params: Promise<{ projectId: string }> }) { const [projectId, setProjectId] = useState<string | null>(null); useEffect(() => { void params.then(({ projectId: id }) => setProjectId(id)); }, [params]); return <WorkspaceShell active="Impact" mode="production" projectId={projectId ?? undefined}><PageHeader breadcrumb="Impact" title="Workflow impact" description="Conservative, transparent estimates from the current workflow snapshot." actions={projectId ? <a className="btn btn-secondary" href={`/projects/${projectId}/evidence`}>Back to evidence</a> : undefined} />{projectId ? <ImpactDashboard projectId={projectId} /> : <p className="empty">Loading impact dashboard…</p>}</WorkspaceShell>; }
