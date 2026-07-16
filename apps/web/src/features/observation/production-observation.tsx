'use client';

import type { ObservationSession, WorkflowEvent } from '@tacit/core-schemas';
import type { WorkspaceDefinition } from '@tacit/workflow-sdk';
import { useEffect, useState } from 'react';
import { PageHeader, WorkspaceShell } from '../ui/app-shell';
import { StatusBadge } from '../demo/status-badge';
import { ObservationTimelineView } from './observation-timeline-view';
import { loadObservation, observationStorageKey, type StoredObservation } from './observation-state';

interface ObservationPayload {
  readonly project: { readonly id: string; readonly name: string; readonly workflowType: string };
  readonly workflow: { readonly name: string; readonly workspace: WorkspaceDefinition };
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
  if (!payload || !observation) return <main className="production-page"><p className="empty">Loading project observation…</p></main>;
  return <WorkspaceShell active="Observe" projectId={projectId} projectName={payload.project.name}>
    <PageHeader breadcrumb="Observe / production project" title={`Observe ${payload.workflow.name}`} description="Link manual steps, narration, transcript selections, and optional browser events to durable evidence." status={<StatusBadge status={canRecord ? 'observing' : 'draft'} />} />
    <section className="stack"><section className="card"><div className="card-header"><div><span className="eyebrow">Evidence-backed observation</span><h2>Extracted source material</h2><p className="muted">Transcript segments, document pages, frames, and spreadsheet extracts remain selectable as durable citations.</p></div><span className="status status-info">{payload.evidence.length} available extracts</span></div>{payload.evidence.length === 0 ? <p className="notice" role="alert">No clean, completed evidence extracts are ready. Return to evidence intake and retry processing before observing this project.</p> : <fieldset className="evidence-selector"><legend>Select evidence used for the next step</legend>{payload.evidence.map((item) => <label key={item.id}><input type="checkbox" checked={selectedEvidenceIds.includes(item.id)} onChange={() => setSelectedEvidenceIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /> <span>{item.title}<small className="muted"> · {item.detail}</small></span></label>)}</fieldset>}</section>
      <section className="card"><h2>Manual step and narration</h2><div className="stack"><label><span className="field-label">Observed action</span><select className="select" value={action} disabled={!canRecord} onChange={(event) => setAction(event.target.value)}>{payload.workflow.workspace.actions.map((item) => <option key={item.id} value={item.eventAction}>{item.label}</option>)}</select></label><label><span className="field-label">What did the expert do or decide?</span><textarea className="input" value={manualStep} disabled={!canRecord} onChange={(event) => setManualStep(event.target.value)} placeholder="Describe the evidence comparison or decision." /></label><button className="btn btn-secondary" type="button" disabled={!canRecord || !manualStep.trim() || !selectedEvidenceIds.length} onClick={() => { record(action, 'user', manualStep.trim(), 'manual_step'); setManualStep(''); }}>Record evidence-linked step</button><label><span className="field-label">Expert narration</span><textarea className="input" value={narration} disabled={!canRecord} onChange={(event) => setNarration(event.target.value)} placeholder="Explain why the decision is safe or where policy is uncertain." /></label><button className="btn btn-secondary" type="button" disabled={!canRecord || !narration.trim() || !selectedEvidenceIds.length} onClick={() => record('narration', 'user', narration.trim(), 'narration')}>Add narration</button></div></section>
      <section className="card"><h2>Optional imported browser event</h2><p className="muted">Import a browser event only when it supports this workflow. General desktop capture is intentionally deferred.</p><div className="inline-form"><input className="input" value={browserEvent} disabled={!canRecord} onChange={(event) => setBrowserEvent(event.target.value)} placeholder="Opened approval policy in browser" /><button className="btn btn-secondary" type="button" disabled={!canRecord || !browserEvent.trim() || !selectedEvidenceIds.length} onClick={() => { record('imported_browser_event', 'import', browserEvent.trim(), 'browser_event'); setBrowserEvent(''); }}>Import event</button></div></section>
      <section className="card"><h2>SME disposition</h2><div className="decision-options">{payload.workflow.workspace.outcomes.map((outcome) => <button className={`decision-card ${observation.decision === outcome.id ? 'is-selected' : ''}`} key={outcome.id} disabled={!canRecord} onClick={() => setObservation((current) => current ? { ...current, decision: outcome.id } : current)}><strong>{outcome.label}</strong></button>)}</div><button className="btn btn-primary" disabled={!canRecord || !observation.decision || !selectedEvidenceIds.length || saving} onClick={() => { void finish(); }}>{saving ? 'Reconstructing workflow…' : 'Finish observation'}</button></section>
      {error ? <section className="notice" role="alert"><p>{error}</p><button className="btn btn-secondary" type="button" onClick={() => { void finish(); }}>Retry</button></section> : null}
      <ObservationTimelineView events={observation.events} actions={payload.workflow.workspace.actions} evidence={payload.evidence} narration={narration} />
    </section>
  </WorkspaceShell>;
}
