'use client';
import { useEffect, useState } from 'react';
import { EvaluationDashboard } from '../../../../features/evaluations/evaluation-dashboard';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
export default function EvaluationsPage({ params }: { readonly params: Promise<{ projectId: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    void params.then(({ projectId: id }) => setProjectId(id));
  }, [params]);
  return (
    <WorkspaceShell active="Test" mode="production" projectId={projectId ?? undefined}>
      <PageHeader
        breadcrumb="Test"
        title="Evaluation & replay"
        description="Measure generated workflow behavior against labelled historical cases."
        actions={projectId ? <a className="btn btn-secondary" href={`/projects/${projectId}/approvals`}>View approvals</a> : undefined}
      />
      {projectId ? (
        <EvaluationDashboard projectId={projectId} />
      ) : (
        <div className="stack" style={{ gap: '20px' }}>
          <div className="card card-subtle">
            <div className="skeleton" style={{ width: '150px', height: '18px', marginBottom: '12px' }} />
            <div className="stack" style={{ gap: '10px' }}>
              <div className="skeleton" style={{ width: '100%', height: '32px' }} />
              <div className="skeleton" style={{ width: '95%', height: '32px' }} />
              <div className="skeleton" style={{ width: '80%', height: '32px' }} />
            </div>
          </div>
          <div className="card" style={{ minHeight: '120px' }}>
            <div className="skeleton" style={{ width: '120px', height: '18px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '180px', height: '14px', marginTop: '4px' }} />
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
