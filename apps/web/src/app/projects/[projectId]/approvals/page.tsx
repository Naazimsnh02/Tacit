'use client';
import { useEffect, useState } from 'react';
import { ApprovalDashboard } from '../../../../features/approvals/approval-dashboard';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
export default function ApprovalsPage({ params }: { readonly params: Promise<{ projectId: string }> }) { const [projectId, setProjectId] = useState<string | null>(null); useEffect(() => { void params.then(({ projectId: id }) => setProjectId(id)); }, [params]); return <WorkspaceShell active="Approvals" projectId={projectId ?? undefined}><PageHeader breadcrumb="Approvals" title="Human approval queue" description="High-risk cases stop here until a human records a decision." />{projectId ? <ApprovalDashboard projectId={projectId} /> : <p className="empty">Loading approvals…</p>}</WorkspaceShell>; }
