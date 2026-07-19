'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WorkflowGraphView } from '../../../../features/workflow-graph/workflow-graph';
import { WorkflowConversation } from '../../../../features/workflow-graph/workflow-conversation';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
import { productionHeaders } from '../../../../features/projects/production-api';
import type { WorkflowGraph } from '../../../../lib/workflow-graph/model';

export default function WorkflowGraphPage({ params }: { readonly params: Promise<{ versionId: string }> }) {
  const [versionId, setVersionId] = useState<string | null>(null); const [graph, setGraph] = useState<WorkflowGraph | null>(null); const [error, setError] = useState<string | null>(null); const projectId = useSearchParams().get('projectId');
  useEffect(() => { void params.then(({ versionId: id }) => setVersionId(id)); }, [params]);
  useEffect(() => { if (!versionId) return; void fetch(`/api/workflow-versions/${versionId}/graph`, { headers: productionHeaders() }).then(async (response) => { const body = await response.json() as WorkflowGraph | { error: string }; if (!response.ok || !('nodes' in body)) throw new Error('error' in body ? body.error : 'Unable to load workflow graph.'); setGraph(body); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load workflow graph.')); }, [versionId]);
  return <WorkspaceShell active="Review" mode="production" projectId={projectId ?? undefined} versionId={versionId ?? undefined}><PageHeader breadcrumb="Review" title="Workflow graph" description="Inspect the main path, alternatives, evidence state, and safety boundary before compiling." actions={projectId && versionId ? <a className="btn btn-primary" href={`/workflow-versions/${versionId}/clarify?projectId=${encodeURIComponent(projectId)}`}>Clarify workflow</a> : undefined} />{error ? <section className="notice" role="alert"><p>{error}</p></section> : !graph ? <p className="empty">Loading workflow graph…</p> : <><WorkflowGraphView graph={graph} />{projectId && versionId ? <div style={{ marginTop: 16 }}><WorkflowConversation projectId={projectId} versionId={versionId} /></div> : null}</>}</WorkspaceShell>;
}
