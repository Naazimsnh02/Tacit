'use client';

import type { ApprovalRequest } from '@tacit/core-schemas';
import { useEffect, useState } from 'react';

const actions = [
  ['approved', 'Approve'], ['rejected', 'Reject'], ['request_more_information', 'Request more information'], ['escalated', 'Escalate'],
] as const;

export function ApprovalDashboard({ projectId }: { readonly projectId: string }) {
  const [requests, setRequests] = useState<readonly ApprovalRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null); const [busyId, setBusyId] = useState<string | null>(null);
  async function load() { try { const response = await fetch(`/api/projects/${projectId}/approvals`); const body = await response.json() as ApprovalRequest[] | { error: string }; if (!response.ok || !Array.isArray(body)) throw new Error('error' in body ? body.error : 'Unable to load approvals.'); setRequests(body); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load approvals.'); } }
  useEffect(() => { void load(); }, [projectId]);
  async function decide(id: string, decision: typeof actions[number][0]) { setBusyId(id); setError(null); try { const response = await fetch(`/api/approvals/${id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, approver: 'Demo manager' }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? 'Unable to record approval action.'); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record approval action.'); } finally { setBusyId(null); } }
  if (!requests) return <main>Loading approval queue…</main>;
  return <main><h1>Human approval queue</h1><p>High-risk cases stop here until a human records a decision.</p>{error ? <p role="alert">{error}</p> : null}{requests.length === 0 ? <p>No approval requests are waiting.</p> : requests.map((request) => <article key={request.id}><h2>{request.requestedAction}</h2><p>Status: {request.status} · Risk: {request.riskLevel}</p><p>Recommendation: {request.agentRecommendation} ({request.confidence === null ? 'confidence unavailable' : `${Math.round(request.confidence * 100)}% confidence`})</p><p>Reason: {request.reason}</p><p>Applied rules: {request.appliedRuleIds.join(', ') || 'None recorded'}</p><p>Evidence: {request.evidenceIds.join(', ')}</p><p>Workflow version: {request.workflowVersionId ?? 'Seeded approval boundary'} · Build: {request.agentBuildId ?? 'Not build-specific'}</p>{request.status === 'pending' ? <div>{actions.map(([decision, label]) => <button key={decision} type="button" disabled={busyId === request.id} onClick={() => { void decide(request.id, decision); }}>{label}</button>)}</div> : <p>Decision recorded. The audit trail is retained with the request.</p>}</article>)}</main>;
}
