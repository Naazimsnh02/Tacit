'use client';

import type { ObservationSession, WorkflowEvent } from '@tacit/core-schemas';
import type { WorkspaceDefinition } from '@tacit/workflow-sdk';
import { useEffect, useState } from 'react';
import { PageHeader, WorkspaceShell } from '../ui/app-shell';
import { StatusBadge } from '../demo/status-badge';
import { ObservationTimelineView } from './observation-timeline-view';
import { loadObservation, observationStorageKey, type StoredObservation } from './observation-state';
import { CustomSelect } from '../ui/custom-select';

interface ObservationPayload {
  readonly project: { readonly id: string; readonly name: string; readonly workflowType: string };
  readonly workflow: { readonly name: string; readonly workspace: WorkspaceDefinition; readonly confirmedVersionId: string | null };
  readonly evidence: readonly { readonly id: string; readonly title: string; readonly detail: string }[];
}

function accessTokenForSession(): string | null {
  try { return (JSON.parse(window.sessionStorage.getItem('tacit.production.session') ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null; } catch { return null; }
}

export function ProductionObservation({ projectId }: { readonly projectId: string }) {
  const [payload, setPayload] = useState<ObservationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [observation, setObservation] = useState<StoredObservation | null>(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [manualStep, setManualStep] = useState('');
  const [narration, setNarration] = useState('');
  const [browserEvent, setBrowserEvent] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const token = accessTokenForSession();
    if (!token) { setError('Sign in to open this production observation.'); return; }
    void fetch(`/api/projects/${projectId}/observation`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const body = await response.json() as ObservationPayload & { error?: string }; if (!response.ok) throw new Error(body.error ?? 'Unable to load the observation.'); return body; })
      .then((value) => { setPayload(value); setSelectedEvidenceIds(value.evidence.map((item) => item.id)); setAction(value.workflow.workspace.actions[0]?.eventAction ?? 'manual_step'); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load the observation.'));
  }, [projectId]);
  useEffect(() => {
    const restored = loadObservation(projectId, window.localStorage.getItem(observationStorageKey(projectId)));
    setObservation(restored); setNarration(restored.session.narration ?? '');
  }, [projectId]);
  useEffect(() => { if (observation) window.localStorage.setItem(observationStorageKey(projectId), JSON.stringify(observation)); }, [observation, projectId]);

  const canRecord = observation?.session.status === 'recording';
  function record(eventAction: string, source: 'user' | 'import', description: string, kind: string) {
    if (!observation || !canRecord) return;
    const event: WorkflowEvent = { id: crypto.randomUUID(), observationSessionId: observation.session.id, source, action: eventAction, occurredAt: new Date().toISOString(), payload: { description, kind }, evidenceIds: selectedEvidenceIds };
    setObservation((current) => current ? { ...current, events: [...current.events, event] } : current);
  }
  async function finish() {
    if (!observation || !canRecord || !observation.decision || !selectedEvidenceIds.length) { setError('Select evidence and an SME disposition before finishing the observation.'); return; }
    const accessToken = accessTokenForSession(); if (!accessToken) { setError('Sign in again before saving this observation.'); return; }
    setSaving(true); setError(null);
    const completedAt = new Date().toISOString();
    const completionEvent: WorkflowEvent = { id: crypto.randomUUID(), observationSessionId: observation.session.id, source: 'user', action: 'complete_observation', occurredAt: completedAt, payload: { decision: observation.decision }, evidenceIds: selectedEvidenceIds };
    const session: ObservationSession = { ...observation.session, status: 'completed', completedAt, narration: narration.trim() || null };
    try {
      const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
      const persisted = await fetch(`/api/projects/${projectId}/sessions`, { method: 'POST', headers, body: JSON.stringify({ session, events: [...observation.events, completionEvent] }) });
      const persistedBody = await persisted.json() as { error?: string }; if (!persisted.ok) throw new Error(persistedBody.error ?? 'Unable to save the observation.');
      const reconstructed = await fetch(`/api/projects/${projectId}/workflow/reconstruct`, { method: 'POST', headers, body: JSON.stringify({ sessionId: session.id, finalDecision: observation.decision }) });
      const reconstructedBody = await reconstructed.json() as { workflowVersionId?: string; error?: string }; if (!reconstructed.ok || !reconstructedBody.workflowVersionId) throw new Error(reconstructedBody.error ?? 'Unable to reconstruct the workflow.');
      setObservation({ ...observation, session, events: [...observation.events, completionEvent] });
      window.location.assign(`/workflow-versions/${reconstructedBody.workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to finish the observation.'); } finally { setSaving(false); }
  }
  if (error && !payload) return <main className="production-page"><section className="notice" role="alert"><p>{error}</p><a className="btn btn-secondary" href="/projects">Return to projects</a></section></main>;
  if (!payload || !observation) {
    return (
      <main className="production-page">
        <div className="skeleton" style={{ width: '40%', height: '36px', marginBottom: '20px' }} />
        <section className="stack" style={{ gap: '20px' }}>
          <div className="card" style={{ minHeight: '120px' }}>
            <div className="skeleton" style={{ width: '20%', height: '18px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '90%', height: '14px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '80%', height: '14px' }} />
          </div>
          <div className="card" style={{ minHeight: '180px' }}>
            <div className="skeleton" style={{ width: '25%', height: '18px', marginBottom: '16px' }} />
            <div className="skeleton" style={{ width: '100%', height: '36px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '100%', height: '72px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '120px', height: '36px' }} />
          </div>
        </section>
      </main>
    );
  }
  return <WorkspaceShell active="Observe" mode="production" projectId={projectId} projectName={payload.project.name} versionId={payload.workflow.confirmedVersionId ?? undefined}>
    <PageHeader breadcrumb="Live knowledge transfer / production project" title={`Live KT for ${payload.workflow.name}`} description="Add the unwritten part of the knowledge transfer: steps, expert explanation, transcript selections, and optional browser events linked to durable evidence." status={<StatusBadge status={canRecord ? 'observing' : 'draft'} />} actions={<a className="btn btn-secondary" href={`/projects/${projectId}/evidence`}>Back to KT materials</a>} />
    <section className="stack"><section className="card"><div className="card-header"><div><span className="eyebrow">Live knowledge transfer</span><h2>Extracted KT materials</h2><p className="muted">Transcript segments, document pages, frames, and spreadsheet extracts remain selectable as durable citations from the knowledge transfer package.</p></div><span className="status status-info">{payload.evidence.length} available extracts</span></div>{payload.evidence.length === 0 ? <p className="notice" role="alert">No clean, completed extracts are ready. Return to knowledge transfer intake and finish processing before continuing this live session.</p> : <fieldset className="evidence-selector"><legend>Select materials used for the next step</legend>{payload.evidence.map((item) => <label key={item.id}><input type="checkbox" checked={selectedEvidenceIds.includes(item.id)} onChange={() => setSelectedEvidenceIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /> <span>{item.title}<small className="muted"> · {item.detail}</small></span></label>)}</fieldset>}</section>
      <section className="card"><h2>Steps and expert explanation</h2><div className="stack"><label><span className="field-label">Action</span><CustomSelect value={action} disabled={!canRecord} onChange={setAction} options={payload.workflow.workspace.actions.map((item) => ({ value: item.eventAction, label: item.label }))} /></label><label><span className="field-label">What would you tell a colleague you did or decided?</span><textarea className="input" value={manualStep} disabled={!canRecord} onChange={(event) => setManualStep(event.target.value)} placeholder="Describe the comparison, judgment, or decision from this knowledge transfer." /></label><button className="btn btn-secondary" type="button" disabled={!canRecord || !manualStep.trim() || !selectedEvidenceIds.length} onClick={() => { record(action, 'user', manualStep.trim(), 'manual_step'); setManualStep(''); }}>Record evidence-linked step</button><label><span className="field-label">Expert knowledge transfer notes</span><textarea className="input" value={narration} disabled={!canRecord} onChange={(event) => setNarration(event.target.value)} placeholder="Explain why the decision is safe or where policy is still uncertain." /></label><button className="btn btn-secondary" type="button" disabled={!canRecord || !narration.trim() || !selectedEvidenceIds.length} onClick={() => record('narration', 'user', narration.trim(), 'narration')}>Add KT notes</button></div></section>
      <section className="card"><h2>Optional imported browser event</h2><p className="muted">Import a browser event only when it supports this workflow. General desktop capture is intentionally deferred.</p><div className="inline-form"><input className="input" value={browserEvent} disabled={!canRecord} onChange={(event) => setBrowserEvent(event.target.value)} placeholder="Opened approval policy in browser" /><button className="btn btn-secondary" type="button" disabled={!canRecord || !browserEvent.trim() || !selectedEvidenceIds.length} onClick={() => { record('imported_browser_event', 'import', browserEvent.trim(), 'browser_event'); setBrowserEvent(''); }}>Import event</button></div></section>
      <section className="card"><h2>SME disposition</h2><div className="stack" style={{ marginTop: 16 }}><div className="decision-options">{payload.workflow.workspace.outcomes.map((outcome) => <button className={`decision-card ${observation.decision === outcome.id ? 'is-selected' : ''}`} key={outcome.id} disabled={!canRecord} onClick={() => setObservation((current) => current ? { ...current, decision: outcome.id } : current)}><strong>{outcome.label}</strong></button>)}</div><button className="btn btn-primary" style={{ width: 'max-content' }} disabled={!canRecord || !observation.decision || !selectedEvidenceIds.length || saving} onClick={() => { void finish(); }}>{saving ? 'Preparing workflow from KT…' : 'Finish knowledge transfer'}</button></div></section>
      {error ? <section className="notice" role="alert"><p>{error}</p><button className="btn btn-secondary" type="button" onClick={() => { void finish(); }}>Retry</button></section> : null}
      <ObservationTimelineView events={observation.events} actions={payload.workflow.workspace.actions} evidence={payload.evidence} narration={narration} />
    </section>
  </WorkspaceShell>;
}
