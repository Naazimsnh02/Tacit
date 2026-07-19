'use client';

import type { ApprovalRequest } from '@tacit/core-schemas';
import { useEffect, useState } from 'react';
import { RecoverableError } from '../demo/recoverable-error';
import { StatusBadge } from '../demo/status-badge';
import { productionHeaders } from '../projects/production-api';
import { tabCache } from '../../lib/tab-cache';

const actions = [['approved', 'Approve'], ['rejected', 'Reject'], ['request_more_information', 'Request information'], ['escalated', 'Escalate']] as const;

export function ApprovalDashboard({ projectId }: { readonly projectId: string }) {
  const [requests, setRequests] = useState<readonly ApprovalRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(isBackground = false) {
    const cacheKey = `${projectId}/approvals`;
    if (!isBackground) {
      const cached = tabCache.get<ApprovalRequest[]>(cacheKey);
      if (cached) {
        setRequests(cached);
      }
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/approvals`, { headers: productionHeaders() });
      const body = await response.json() as ApprovalRequest[] | { error: string };
      if (!response.ok || !Array.isArray(body)) throw new Error();
      setRequests(body);
      tabCache.set(cacheKey, body);
    } catch {
      const cached = tabCache.get<ApprovalRequest[]>(cacheKey);
      if (!cached) {
        setError('The approval queue could not be loaded.');
      }
    }
  }

  useEffect(() => {
    void load(false);
  }, [projectId]);

  async function decide(id: string, decision: typeof actions[number][0]) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/approvals/${id}/decision`, {
        method: 'POST',
        headers: productionHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ decision })
      });
      if (!response.ok) throw new Error();
      
      // Clear cache and load fresh data
      tabCache.clear(`${projectId}/approvals`);
      await load(true);
    } catch {
      setError('The approval decision was not recorded.');
    } finally {
      setBusyId(null);
    }
  }

  if (!requests && !error) {
    return (
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
    );
  }
  return <section className="stack">{error ? <RecoverableError message={error} onRetry={() => { void load(); }} /> : null}{requests?.length === 0 ? <section className="card"><p className="empty">No approval requests are waiting.</p></section> : requests?.map((request) => <article className="card" key={request.id}><div className="card-header"><div><span className="metric-label">Risk level: {request.riskLevel}</span><h2>{request.requestedAction}</h2></div><StatusBadge status={request.status === 'pending' ? 'approval_required' : 'verified'} /></div><div className="split"><dl className="data-list"><div><dt>Agent recommendation</dt><dd>{request.agentRecommendation} {request.confidence === null ? '(confidence unavailable)' : `(${Math.round(request.confidence * 100)}% confidence)`}</dd></div><div><dt>Applied rules</dt><dd>{request.appliedRuleIds.join(', ') || 'None recorded'}</dd></div><div><dt>Evidence</dt><dd>{request.evidenceIds.length} reference{request.evidenceIds.length === 1 ? '' : 's'} attached</dd></div></dl><aside className="card card-subtle"><span className="metric-label">Agent rationale</span><p>{request.reason}</p>{request.status === 'pending' ? <div className="header-actions" style={{ justifyContent: 'flex-start' }}>{actions.map(([decision, label]) => <button className={`btn ${decision === 'approved' ? 'btn-primary' : decision === 'rejected' ? 'btn-danger' : 'btn-secondary'}`} key={decision} type="button" disabled={busyId === request.id} onClick={() => { void decide(request.id, decision); }}>{label}</button>)}</div> : <p className="status status-success">Decision recorded; audit trail retained.</p>}</aside></div></article>)}</section>;
}
