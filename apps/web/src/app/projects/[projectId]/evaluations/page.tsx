'use client';
import { useEffect, useState } from 'react';
import { EvaluationDashboard } from '../../../../features/evaluations/evaluation-dashboard';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
export default function EvaluationsPage({ params }: { readonly params: Promise<{ projectId: string }> }) { const [projectId, setProjectId] = useState<string | null>(null); useEffect(() => { void params.then(({ projectId: id }) => setProjectId(id)); }, [params]); return <WorkspaceShell active="Test" projectId={projectId ?? undefined}><PageHeader breadcrumb="Test" title="Evaluation & replay" description="Measure generated workflow behavior against labelled historical cases." />{projectId ? <EvaluationDashboard projectId={projectId} /> : <p className="empty">Loading historical replay…</p>}</WorkspaceShell>; }
