'use client';

import { useEffect, useState } from 'react';
import { EvaluationDashboard } from '../../../../features/evaluations/evaluation-dashboard';

export default function EvaluationsPage({ params }: { readonly params: Promise<{ projectId: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => { void params.then(({ projectId: id }) => setProjectId(id)); }, [params]);
  return <main>{projectId ? <EvaluationDashboard projectId={projectId} /> : 'Loading historical replay…'}</main>;
}
