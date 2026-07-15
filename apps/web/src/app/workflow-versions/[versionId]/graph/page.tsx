'use client';

import { useEffect, useState } from 'react';
import { WorkflowGraphView } from '../../../../features/workflow-graph/workflow-graph';
import type { WorkflowGraph } from '../../../../lib/workflow-graph/model';

export default function WorkflowGraphPage({ params }: { readonly params: Promise<{ versionId: string }> }) {
  const [versionId, setVersionId] = useState<string | null>(null);
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void params.then(({ versionId: id }) => setVersionId(id)); }, [params]);
  useEffect(() => { if (!versionId) return; void fetch(`/api/workflow-versions/${versionId}/graph`).then(async (response) => { const body = await response.json() as WorkflowGraph | { error: string }; if (!response.ok || !('nodes' in body)) throw new Error('error' in body ? body.error : 'Unable to load workflow graph.'); setGraph(body); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load workflow graph.')); }, [versionId]);
  if (error) return <main><p role="alert">{error}</p></main>;
  if (!graph) return <main>Loading workflow graph…</main>;
  return <main><h1>Workflow graph</h1><p>Inspect each automation boundary before compiling the agent.</p><WorkflowGraphView graph={graph} /></main>;
}
