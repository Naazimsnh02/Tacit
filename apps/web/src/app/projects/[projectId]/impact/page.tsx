'use client';
import { useEffect, useState } from 'react';
import { ImpactDashboard } from '../../../../features/impact/impact-dashboard';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
export default function ImpactPage({ params }: { readonly params: Promise<{ projectId: string }> }) { const [projectId, setProjectId] = useState<string | null>(null); useEffect(() => { void params.then(({ projectId: id }) => setProjectId(id)); }, [params]); return <WorkspaceShell active="Impact" projectId={projectId ?? undefined}><PageHeader breadcrumb="Impact" title="Workflow impact" description="Conservative, transparent estimates from the current workflow snapshot." />{projectId ? <ImpactDashboard projectId={projectId} /> : <p className="empty">Loading impact dashboard…</p>}</WorkspaceShell>; }
