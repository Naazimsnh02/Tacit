'use client';

import type { ObservationSession, WorkflowEvent } from '@tacit/core-schemas';
import type { WorkspaceDefinition, WorkspacePanelData } from '@tacit/workflow-sdk';
import { useEffect, useMemo, useState } from 'react';
import { loadObservation, observationStorageKey, type StoredObservation } from './observation-state';
import { ObservationTimelineView } from './observation-timeline-view';
import { DemoControls } from '../demo/demo-controls';
import { StatusBadge } from '../demo/status-badge';
import { PageHeader, WorkspaceShell } from '../ui/app-shell';

interface EvidenceOption { id: string; title: string; }

interface ObservationWorkspaceProps {
  readonly projectId: string;
  readonly workflowName: string;
  readonly workspace: WorkspaceDefinition;
  readonly panelData: readonly WorkspacePanelData[];
  readonly evidence: readonly EvidenceOption[];
}

function valueText(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && value >= 1000) return new Intl.NumberFormat('en-IN').format(value);
  return String(value);
}

export function ObservationWorkspace({ projectId, workflowName, workspace, panelData, evidence }: ObservationWorkspaceProps) {
  const [observation, setObservation] = useState<StoredObservation | null>(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(evidence.map((item) => item.id));
  const [activePanelId, setActivePanelId] = useState(workspace.panels.find((panel) => panel.kind === 'reference')?.id ?? '');
  const [narration, setNarration] = useState('');
  const [microphoneState, setMicrophoneState] = useState<'idle' | 'listening' | 'unavailable'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [completionState, setCompletionState] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    const storedValue = window.localStorage.getItem(observationStorageKey(projectId));
    const restored = loadObservation(projectId, storedValue);
    setObservation(restored);
    setNarration(restored.session.narration ?? '');
  }, [projectId]);

  useEffect(() => {
    if (observation) window.localStorage.setItem(observationStorageKey(projectId), JSON.stringify(observation));
  }, [observation, projectId]);

  const panelById = useMemo(() => new Map(panelData.map((panel) => [panel.panelId, panel])), [panelData]);
  const status = observation?.session.status;
  const canRecord = status === 'recording';

  function startSession() {
    setError(null);
    setNarration('');
    setObservation(loadObservation(projectId, null));
  }

  function resetDemo() {
    window.localStorage.removeItem(observationStorageKey(projectId));
    setNarration(''); setError(null); setCompletionState('idle'); setObservation(loadObservation(projectId, null));
  }

  function updateSession(update: Partial<ObservationSession>) {
    setObservation((current) => current ? { ...current, session: { ...current.session, ...update } } : current);
  }

  function record(action: string, payload: Record<string, unknown> = {}) {
    if (!observation || !canRecord) return;
    const panelId = typeof payload.panel === 'string' ? payload.panel : null;
    const fields = panelId ? panelById.get(panelId)?.values : undefined;
    const event: WorkflowEvent = {
      id: crypto.randomUUID(), observationSessionId: observation.session.id, source: 'user', action,
      occurredAt: new Date().toISOString(), payload: { ...payload, ...(fields ? { fields } : {}) }, evidenceIds: selectedEvidenceIds,
    };
    setObservation((current) => current ? { ...current, events: [...current.events, event] } : current);
  }

  function chooseDecision(decision: string) {
    if (!canRecord) return;
    setObservation((current) => current ? { ...current, decision } : current);
    record('select_decision', { decision });
  }

  function saveNarration() {
    if (!canRecord || !observation) return;
    updateSession({ narration: narration.trim() || null });
    record('add_note', { narration: narration.trim(), kind: 'narration' });
  }

  async function captureMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) { setMicrophoneState('unavailable'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneState('listening');
    } catch { setMicrophoneState('unavailable'); }
  }

  async function completeSession() {
    if (!observation || !canRecord) return;
    if (!observation.decision) { setError('Select a final decision before completing the review.'); return; }
    setCompletionState('saving'); setError(null);
    const completedAt = new Date().toISOString();
    const completionEvent: WorkflowEvent = {
      id: crypto.randomUUID(), observationSessionId: observation.session.id, source: 'user', action: 'complete_review', occurredAt: completedAt,
      payload: { decision: observation.decision }, evidenceIds: selectedEvidenceIds,
    };
    const completedSession: ObservationSession = { ...observation.session, status: 'completed', completedAt, narration: narration.trim() || null };
    try {
      const persisted = await fetch(`/api/projects/${projectId}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: completedSession, events: [...observation.events, completionEvent] }) });
      const persistedBody = await persisted.json() as { error?: string };
      if (!persisted.ok) throw new Error(persistedBody.error ?? 'Unable to save the observation.');
      const reconstructed = await fetch(`/api/projects/${projectId}/workflow/reconstruct`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: completedSession.id, finalDecision: observation.decision }) });
      const reconstructedBody = await reconstructed.json() as { workflowVersionId?: string; error?: string };
      if (!reconstructed.ok || !reconstructedBody.workflowVersionId) throw new Error(reconstructedBody.error ?? 'Unable to reconstruct the workflow.');
      setObservation({ ...observation, session: completedSession, events: [...observation.events, completionEvent] });
      window.location.assign(`/workflow-versions/${reconstructedBody.workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}`);
    } catch (reason) { setCompletionState('error'); setError(reason instanceof Error ? reason.message : 'Unable to complete the observation.'); }
  }

  const documentPanel = workspace.panels.find((panel) => panel.kind === 'document');
  const activePanel = workspace.panels.find((panel) => panel.id === activePanelId);
  const activeData = activePanel ? panelById.get(activePanel.id) : undefined;

  if (!observation) return <WorkspaceShell active="Observe" projectId={projectId} projectName={workflowName}><p className="empty">Loading observation workspace…</p></WorkspaceShell>;

  return <WorkspaceShell active="Observe" projectId={projectId} projectName={workflowName}><PageHeader breadcrumb={`Observe / ${workflowName}`} title="Invoice exception demonstration" description="Record the expert’s evidence-backed review as structured workflow events." status={<StatusBadge status={status === 'recording' ? 'observing' : 'draft'} />} actions={<DemoControls stage="observe" onReset={resetDemo} onStart={startSession} />} />
    <section className="three-col">
      <Panel title={documentPanel?.label ?? 'Document'}>
        <Fields fields={documentPanel?.fields ?? []} values={panelById.get(documentPanel?.id ?? '')?.values ?? {}} />
        <button className="btn btn-secondary" disabled={!canRecord} onClick={() => record('open_document', { panel: documentPanel?.id })}>Record document opened</button>
      </Panel>
      <Panel title="Reference systems">
        <nav className="tabs">
          {workspace.panels.filter((panel) => panel.kind === 'reference').map((panel) => <button className="tab" key={panel.id} onClick={() => { setActivePanelId(panel.id); record('switch_tab', { panel: panel.id }); }} disabled={!canRecord && activePanelId !== panel.id} aria-pressed={activePanelId === panel.id}>{panel.label}</button>)}
        </nav>
        {activePanel && <Fields fields={activePanel.fields} values={activeData?.values ?? {}} />}
        <h3>Record an action</h3>
        <div className="header-actions" style={{ justifyContent: 'flex-start' }}>
          {workspace.actions.filter((action) => action.id !== 'switch_tab' && action.id !== 'select_decision' && action.id !== 'complete_review').map((action) => <button className="btn btn-secondary" key={action.id} disabled={!canRecord} onClick={() => record(action.eventAction, { actionId: action.id, panel: activePanelId })}>{action.label}</button>)}
        </div>
      </Panel>
      <Panel title="Observation controls">
        <div className="card-header"><span className="metric-label">Recording state</span>{status === 'recording' ? <StatusBadge status="observing" /> : <StatusBadge status="draft" />}</div>
        <div className="header-actions" style={{ justifyContent: 'flex-start' }}>
          {status !== 'recording' && status !== 'paused' && <button className="btn btn-primary" onClick={startSession}>Start session</button>}
          {status === 'recording' && <button className="btn btn-secondary" onClick={() => updateSession({ status: 'paused' })}>Pause</button>}
          {status === 'paused' && <button className="btn btn-secondary" onClick={() => updateSession({ status: 'recording' })}>Resume</button>}
          <button className="btn btn-primary" disabled={!canRecord || completionState === 'saving'} onClick={() => { void completeSession(); }}>{completionState === 'saving' ? 'Saving and reconstructing…' : 'Complete and continue'}</button>
        </div>
        <label className="field-label" style={{ marginTop: 16 }}>Narration<textarea className="textarea" value={narration} onChange={(event) => setNarration(event.target.value)} placeholder="Explain what you are checking and why." disabled={!canRecord} /></label>
        <div className="header-actions" style={{ justifyContent: 'flex-start' }}><button className="btn btn-secondary" disabled={!canRecord} onClick={saveNarration}>Save narration</button><button className="btn btn-ghost" disabled={!canRecord} onClick={captureMicrophone}>Use microphone</button></div>
        {microphoneState === 'listening' && <p className="status status-success">Microphone available; text narration remains the saved fallback.</p>}
        {microphoneState === 'unavailable' && <p className="status status-warning">Microphone unavailable; continue with text narration.</p>}
        <fieldset style={{ marginTop: 16, border: 0, padding: 0 }}><legend className="field-label">Evidence references</legend>{evidence.map((item) => <label key={item.id} style={{ display: 'block', marginBottom: 7 }}><input type="checkbox" checked={selectedEvidenceIds.includes(item.id)} onChange={() => setSelectedEvidenceIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /> {item.title}</label>)}</fieldset>
        <h3>Current decision</h3>
        <div className="header-actions" style={{ justifyContent: 'flex-start' }}>{workspace.outcomes.map((outcome) => <button className={`btn ${observation.decision === outcome.id ? 'btn-primary' : 'btn-secondary'}`} key={outcome.id} disabled={!canRecord} onClick={() => chooseDecision(outcome.id)}>{outcome.label}</button>)}</div>
        <label className="field-label" style={{ marginTop: 16 }}>Notes<textarea className="textarea" value={observation.notes} disabled={!canRecord} onChange={(event) => setObservation((current) => current ? { ...current, notes: event.target.value } : current)} /></label>
        <p className="muted"><strong style={{ color: 'var(--text)' }}>Recorded events:</strong> {observation.events.length}</p>
        {error && <section role="alert" className="notice"><p>We could not complete this observation. Your recorded steps are still available.</p><button className="btn btn-secondary" type="button" onClick={() => { void completeSession(); }}>Retry</button><button className="btn btn-danger" type="button" onClick={resetDemo}>Reset demo</button></section>}
        {observation.events.length > 0 && <details><summary>Recorded activity</summary><ol>{observation.events.slice(-5).reverse().map((event) => <li key={event.id}>{new Date(event.occurredAt).toLocaleTimeString()} — {event.action} ({event.evidenceIds.length} evidence reference{event.evidenceIds.length === 1 ? '' : 's'})</li>)}</ol></details>}
      </Panel>
    </section>
    <ObservationTimelineView events={observation.events} actions={workspace.actions} evidence={evidence} narration={observation.session.narration} />
  </WorkspaceShell>;
}

function Panel({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return <section className="card"><h2>{title}</h2>{children}</section>;
}

function Fields({ fields, values }: { readonly fields: readonly { id: string; label: string }[]; readonly values: Readonly<Record<string, string | number | boolean | null>> }) {
  return <dl className="data-list">{fields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{valueText(values[field.id])}</dd></div>)}</dl>;
}
