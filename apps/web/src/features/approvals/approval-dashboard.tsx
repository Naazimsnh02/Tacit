'use client';

import type { ApprovalRequest } from '@tacit/core-schemas';
import { useEffect, useState } from 'react';
import { RecoverableError } from '../demo/recoverable-error';
import { StatusBadge } from '../demo/status-badge';

const actions = [['approved', 'Approve'], ['rejected', 'Reject'], ['request_more_information', 'Request information'], ['escalated', 'Escalate']] as const;

export function ApprovalDashboard({ projectId }: { readonly projectId: string }) {
  const [requests, setRequests] = useState<readonly ApprovalRequest[] | null>(null); const [error, setError] = useState<string | null>(null); const [busyId, setBusyId] = useState<string | null>(null);
  async function load() { try { const response = await fetch(`/api/projects/${projectId}/approvals`); const body = await response.json() as ApprovalRequest[] | { error: string }; if (!response.ok || !Array.isArray(body)) throw new Error(); setRequests(body); } catch { setError('The approval queue could not be loaded.'); } }
  useEffect(() => { void load(); }, [projectId]);
  async function decide(id: string, decision: typeof actions[number][0]) { setBusyId(id); setError(null); try { const response = await fetch(`/api/approvals/${id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, approver: 'Demo manager' }) }); if (!response.ok) throw new Error(); await load(); } catch { setError('The approval decision was not recorded.'); } finally { setBusyId(null); } }
  if (!requests && !error) return <p className="empty">Loading approval queue…</p>;
  return <section className="stack">{error ? <RecoverableError message={error} onRetry={() => { void load(); }} /> : null}{requests?.length === 0 ? <section className="card"><p className="empty">No approval requests are waiting.</p></section> : requests?.map((request) => <article className="card" key={request.id}><div className="card-header"><div><span className="metric-label">Risk level: {request.riskLevel}</span><h2>{request.requestedAction}</h2></div><StatusBadge status={request.status === 'pending' ? 'approval_required' : 'verified'} /></div><div className="split"><dl className="data-list"><div><dt>Agent recommendation</dt><dd>{request.agentRecommendation} {request.confidence === null ? '(confidence unavailable)' : `(${Math.round(request.confidence * 100)}% confidence)`}</dd></div><div><dt>Applied rules</dt><dd>{request.appliedRuleIds.join(', ') || 'None recorded'}</dd></div><div><dt>Evidence</dt><dd>{request.evidenceIds.length} reference{request.evidenceIds.length === 1 ? '' : 's'} attached</dd></div></dl><aside className="card card-subtle"><span className="metric-label">Agent rationale</span><p>{request.reason}</p>{request.status === 'pending' ? <div className="header-actions" style={{ justifyContent: 'flex-start' }}>{actions.map(([decision, label]) => <button className={`btn ${decision === 'approved' ? 'btn-primary' : decision === 'rejected' ? 'btn-danger' : 'btn-secondary'}`} key={decision} type="button" disabled={busyId === request.id} onClick={() => { void decide(request.id, decision); }}>{label}</button>)}</div> : <p className="status status-success">Decision recorded; audit trail retained.</p>}</aside></div></article>)}</section>;
}
