'use client';
import { useEffect, useState } from 'react';
import { BuildConsole } from '../../../../../../features/agent-builds/build-console';
import { PageHeader, WorkspaceShell } from '../../../../../../features/ui/app-shell';
export default function AgentBuildPage({ params }: { readonly params: Promise<{ projectId: string; versionId: string }> }) { const [route, setRoute] = useState<{ projectId: string; versionId: string } | null>(null); useEffect(() => { void params.then(setRoute); }, [params]); return <WorkspaceShell active="Build" projectId={route?.projectId} versionId={route?.versionId}><PageHeader breadcrumb="Build" title="Compile agent" description="Generate constrained artifacts from the confirmed workflow version." />{route ? <BuildConsole projectId={route.projectId} workflowVersionId={route.versionId} /> : <p className="empty">Loading build console…</p>}</WorkspaceShell>; }
