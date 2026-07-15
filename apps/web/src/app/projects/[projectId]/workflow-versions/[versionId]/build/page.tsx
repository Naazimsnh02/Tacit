'use client';

import { useEffect, useState } from 'react';
import { BuildConsole } from '../../../../../../features/agent-builds/build-console';

export default function AgentBuildPage({ params }: { readonly params: Promise<{ projectId: string; versionId: string }> }) {
  const [route, setRoute] = useState<{ projectId: string; versionId: string } | null>(null);
  useEffect(() => { void params.then(setRoute); }, [params]);
  if (!route) return <main>Loading build console…</main>;
  return <main><BuildConsole projectId={route.projectId} workflowVersionId={route.versionId} /></main>;
}
