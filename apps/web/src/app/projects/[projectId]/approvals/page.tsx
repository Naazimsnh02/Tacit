'use client';
import { useEffect, useState } from 'react';
import { ApprovalDashboard } from '../../../../features/approvals/approval-dashboard';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
export default function ApprovalsPage({ params }: { readonly params: Promise<{ projectId: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    void params.then(({ projectId: id }) => setProjectId(id));
  }, [params]);
  return (
    <WorkspaceShell active="Approve" mode="production" projectId={projectId ?? undefined}>
      <PageHeader
        breadcrumb="Approve"
        title="Human approval queue"
        description="High-risk cases stop here until a human records a decision."
        actions={projectId ? <a className="btn btn-secondary" href={`/projects/${projectId}/operate`}>Open operating review</a> : undefined}
      />
      {projectId ? (
        <ApprovalDashboard projectId={projectId} />
      ) : (
        <div className="stack" style={{ gap: '20px' }}>
          {[1, 2].map((i) => (
            <div className="card" key={i} style={{ minHeight: '160px' }}>
              <div className="card-header" style={{ marginBottom: '16px' }}>
                <div style={{ width: '60%' }}>
                  <div className="skeleton" style={{ width: '80px', height: '14px', marginBottom: '8px' }} />
                  <div className="skeleton" style={{ width: '200px', height: '20px' }} />
                </div>
                <div className="skeleton" style={{ width: '100px', height: '24px', borderRadius: '999px' }} />
              </div>
              <div className="split">
                <div className="stack" style={{ gap: '12px', flex: 1 }}>
                  <div className="skeleton" style={{ width: '90%', height: '14px' }} />
                  <div className="skeleton" style={{ width: '80%', height: '14px' }} />
                  <div className="skeleton" style={{ width: '70%', height: '14px' }} />
                </div>
                <div className="card card-subtle" style={{ width: '40%', minHeight: '80px', margin: 0 }}>
                  <div className="skeleton" style={{ width: '80px', height: '12px', marginBottom: '8px' }} />
                  <div className="skeleton" style={{ width: '100%', height: '36px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}
