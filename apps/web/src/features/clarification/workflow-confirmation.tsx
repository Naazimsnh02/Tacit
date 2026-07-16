'use client';

import { useState } from 'react';

function token(): string | null {
  try { return (JSON.parse(window.sessionStorage.getItem('tacit.production.session') ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null; } catch { return null; }
}

export function WorkflowConfirmation({ projectId, workflowVersionId }: { readonly projectId: string; readonly workflowVersionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  async function confirm() {
    const accessToken = token();
    if (!accessToken) { setError('Sign in to confirm this production workflow.'); return; }
    setSubmitting(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/workflow-versions/${workflowVersionId}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ rulesConfirmed: true, contradictionsReviewed: true, automationBoundariesConfirmed: true, approvalPoliciesConfirmed: true }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to confirm the workflow.');
      window.location.assign(`/projects/${projectId}/workflow-versions/${workflowVersionId}/build`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to confirm the workflow.'); } finally { setSubmitting(false); }
  }
  return <section className="card" style={{ marginTop: 16 }}><h2>SME workflow confirmation</h2><p className="muted">By confirming, you attest that all rules, contradictions, automation boundaries, and approval policies have been reviewed. This immutable record is required before a production build can start.</p><button className="btn btn-primary" type="button" disabled={submitting} onClick={() => { void confirm(); }}>{submitting ? 'Confirming…' : 'Confirm workflow for build'}</button>{error ? <p className="notice" role="alert">{error}</p> : null}</section>;
}
