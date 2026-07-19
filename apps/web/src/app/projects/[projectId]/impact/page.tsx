'use client';
import { useEffect, useState } from 'react';
import { ImpactDashboard } from '../../../../features/impact/impact-dashboard';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
export default function ImpactPage({ params }: { readonly params: Promise<{ projectId: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    void params.then(({ projectId: id }) => setProjectId(id));
  }, [params]);
  return (
    <WorkspaceShell active="Impact" mode="production" projectId={projectId ?? undefined}>
      <PageHeader
        breadcrumb="Impact"
        title="Workflow impact"
        description="Conservative, transparent estimates from the current workflow snapshot."
      />
      {projectId ? (
        <ImpactDashboard projectId={projectId} />
      ) : (
        <div className="stack" style={{ gap: '20px' }}>
          <div className="card card-subtle" style={{ minHeight: '60px' }}>
            <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '320px', height: '12px' }} />
          </div>
          <div className="metric-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="card metric-card" key={i}>
                <div className="skeleton" style={{ width: '60%', height: '12px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '40%', height: '24px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '80%', height: '12px' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
