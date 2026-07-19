'use client';

import type { ObservationSession, WorkflowEvent } from '@tacit/core-schemas';
import type { WorkspaceDefinition, WorkspacePanelData } from '@tacit/workflow-sdk';
import { useEffect, useMemo, useState } from 'react';
import { loadObservation, observationStorageKey, type StoredObservation } from './observation-state';
import { ObservationTimelineView } from './observation-timeline-view';
import { DemoControls } from '../demo/demo-controls';
import { StatusBadge } from '../demo/status-badge';
import { PageHeader, WorkspaceShell } from '../ui/app-shell';

interface EvidenceOption { readonly id: string; readonly title: string; }

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
  const [activePanelId, setActivePanelId] = useState('invoice');
  const [narration, setNarration] = useState('');
  const [microphoneState, setMicrophoneState] = useState<'idle' | 'listening' | 'unavailable'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [completionState, setCompletionState] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    const restored = loadObservation(projectId, window.localStorage.getItem(observationStorageKey(projectId)));
    setObservation(restored);
    setNarration(restored.session.narration ?? '');
  }, [projectId]);

  useEffect(() => {
    if (observation) window.localStorage.setItem(observationStorageKey(projectId), JSON.stringify(observation));
  }, [observation, projectId]);

  const panelById = useMemo(() => new Map(panelData.map((panel) => [panel.panelId, panel])), [panelData]);
  const status = observation?.session.status;
  const canRecord = status === 'recording';
  const activePanel = workspace.panels.find((panel) => panel.id === activePanelId);
  const invoiceValues = panelById.get('invoice')?.values ?? {};
  const purchaseOrderValues = panelById.get('purchase-order')?.values ?? {};
  const deliveryValues = panelById.get('delivery-record')?.values ?? {};
  const emailValues = panelById.get('vendor-email')?.values ?? {};
  const approvalValues = panelById.get('approval-matrix')?.values ?? {};

  function startSession() {
    setError(null);
    setNarration('');
    setObservation(loadObservation(projectId, null));
  }

  function resetDemo() {
    window.localStorage.removeItem(observationStorageKey(projectId));
    setNarration('');
    setError(null);
    setCompletionState('idle');
    setActivePanelId('invoice');
    setObservation(loadObservation(projectId, null));
  }

  function record(action: string, payload: Record<string, unknown> = {}) {
    if (!observation || !canRecord) return;
    const panelId = typeof payload.panel === 'string' ? payload.panel : null;
    const fields = panelId ? panelById.get(panelId)?.values : undefined;
    const event: WorkflowEvent = {
      id: crypto.randomUUID(),
      observationSessionId: observation.session.id,
      source: 'user',
      action,
      occurredAt: new Date().toISOString(),
      payload: { ...payload, ...(fields ? { fields } : {}) },
      evidenceIds: selectedEvidenceIds,
    };
    setObservation((current) => current ? { ...current, events: [...current.events, event] } : current);
  }

  function openEvidence(panelId: string, action: string) {
    setActivePanelId(panelId);
    record(action, { panel: panelId });
  }

  function chooseDecision(decision: string) {
    if (!canRecord) return;
    setObservation((current) => current ? { ...current, decision } : current);
    record('select_decision', { decision });
  }

  function saveNarration() {
    if (!canRecord || !observation || !narration.trim()) return;
    setObservation((current) => current ? { ...current, session: { ...current.session, narration: narration.trim() } } : current);
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
    if (!observation.decision) { setError('Select the expert disposition before finishing the observation.'); return; }
    setCompletionState('saving'); setError(null);
    const completedAt = new Date().toISOString();
    const completionEvent: WorkflowEvent = { id: crypto.randomUUID(), observationSessionId: observation.session.id, source: 'user', action: 'complete_review', occurredAt: completedAt, payload: { decision: observation.decision }, evidenceIds: selectedEvidenceIds };
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

  if (!observation) return <WorkspaceShell active="Observe" projectId={projectId} projectName={workflowName}><p className="empty">Loading observation workspace...</p></WorkspaceShell>;

  return <WorkspaceShell active="Observe" projectId={projectId} projectName={workflowName}>
    <PageHeader breadcrumb={`Observe / ${workflowName}`} title="Live knowledge transfer for a real exception" description="Hand over the evidence, judgment, and safety boundaries the way you would brief a colleague. Tacit prepares the workflow from this KT session." status={<StatusBadge status={status === 'recording' ? 'observing' : 'draft'} />} actions={<DemoControls stage="observe" onReset={resetDemo} onStart={startSession} />} />
    <section className="observation-hero">
      <img src="/images/ap-reviewer-observation.png" alt="Accounts-payable specialist reviewing a document" />
      <div className="observation-hero-copy"><span className="observation-kicker"><span className="recording-dot" /> Live knowledge transfer</span><h2>Invoice exception review</h2><p>Follow the KT trail as Maya verifies a quantity mismatch and explains the decision before approving the invoice.</p><div className="observation-hero-meta"><span>INV-2048</span><span>Quantity mismatch</span><span>₹425,000</span></div></div>
      <div className="observation-hero-status"><span>Capture quality</span><strong>Evidence linked</strong><small>{observation.events.length} events captured</small></div>
    </section>

    <section className="observation-stage">
      <aside className="inbox-panel">
        <div className="surface-heading"><div><span className="eyebrow">Evidence source</span><h2>Operations inbox</h2></div><span className="inbox-count">1 urgent</span></div>
        <button type="button" className={`mail-card ${activePanelId === 'vendor-email' ? 'is-active' : ''}`} disabled={!canRecord} onClick={() => openEvidence('vendor-email', 'read_email')}><div className="mail-avatar">VS</div><div><strong>Vertex Supplies</strong><span className="mail-subject">Re: INV-2048 delivery adjustment</span><p>{valueText(emailValues.body).slice(0, 115)}{String(emailValues.body ?? '').length > 115 ? '...' : ''}</p></div><time>09:06</time></button>
        <div className="email-preview"><span className="eyebrow">Selected evidence</span><h3>{valueText(emailValues.subject)}</h3><p>{valueText(emailValues.body)}</p><div className="evidence-chip">Vendor confirmation · linked</div></div>
        <button className="quiet-action" type="button" disabled={!canRecord} onClick={() => openEvidence('vendor-email', 'open_vendor_history')}>View vendor history <span>↗</span></button>
      </aside>

      <main className="document-stage">
        <div className="surface-heading"><div><span className="eyebrow">Primary document</span><h2>Invoice INV-2048</h2></div><button className="icon-action" type="button" disabled={!canRecord} onClick={() => openEvidence('invoice', 'open_document')} aria-label="Open invoice document">↗</button></div>
        <button className="invoice-document" type="button" disabled={!canRecord} onClick={() => openEvidence('invoice', 'open_document')}><div className="document-topline"><span>VERTEX SUPPLIES LTD.</span><span>Invoice</span></div><div className="document-title"><div><small>Billed to</small><strong>Northstar Operations</strong></div><div><small>Invoice no.</small><strong>{valueText(invoiceValues.reference)}</strong></div></div><div className="invoice-lines"><div className="invoice-line invoice-line-head"><span>Item</span><span>PO quantity</span><span>Invoice quantity</span><span>Total</span></div><div className="invoice-line"><span>Standard supply line</span><span>{valueText(purchaseOrderValues.quantity)}</span><span className="mismatch-value">{valueText(invoiceValues.quantity)} <small>-2%</small></span><span>{valueText(invoiceValues.value)}</span></div></div><div className="invoice-total"><span>Exception reason</span><strong>Quantity differs from purchase order</strong><b>{valueText(invoiceValues.value)}</b></div></button>
        <div className="evidence-actions">
          <button type="button" className={`evidence-tile ${activePanelId === 'purchase-order' ? 'is-active' : ''}`} disabled={!canRecord} onClick={() => openEvidence('purchase-order', 'compare_values')}><span className="tile-icon">PO</span><span><strong>Purchase order</strong><small>{valueText(purchaseOrderValues.quantity)} approved units</small></span><i>Compare</i></button>
          <button type="button" className={`evidence-tile ${activePanelId === 'delivery-record' ? 'is-active' : ''}`} disabled={!canRecord} onClick={() => openEvidence('delivery-record', 'compare_values')}><span className="tile-icon">✓</span><span><strong>Delivery receipt</strong><small>Delivery {valueText(deliveryValues.confirmed) === 'Yes' ? 'confirmed' : 'pending'}</small></span><i>Verify</i></button>
          <button type="button" className={`evidence-tile ${activePanelId === 'approval-matrix' ? 'is-active' : ''}`} disabled={!canRecord} onClick={() => openEvidence('approval-matrix', 'check_approval_threshold')}><span className="tile-icon">₹</span><span><strong>Approval policy</strong><small>Threshold {valueText(approvalValues.managerApprovalThreshold)}</small></span><i>Check</i></button>
        </div>
        {activePanel && activePanel.id !== 'invoice' && <section className="context-card"><span className="eyebrow">Now reviewing</span><h3>{activePanel.label}</h3><Fields fields={activePanel.fields} values={panelById.get(activePanel.id)?.values ?? {}} /></section>}
      </main>

      <aside className="tacit-rail">
        <div className="surface-heading"><div><span className="eyebrow">Tacit live capture</span><h2>Evidence trail</h2></div><span className="capture-pill"><span className="recording-dot" /> Recording</span></div>
        <ol className="capture-list">{observation.events.length === 0 ? <li className="capture-empty"><span>01</span><div><strong>Waiting for the review</strong><p>Open the invoice and evidence sources as you normally would. Tacit will structure every meaningful action.</p></div></li> : observation.events.slice(-5).reverse().map((event, index) => <li key={event.id}><span>{String(observation.events.length - index).padStart(2, '0')}</span><div><strong>{workspace.actions.find((action) => action.eventAction === event.action)?.timelineStep ?? event.action}</strong><p>{event.evidenceIds.length} evidence reference{event.evidenceIds.length === 1 ? '' : 's'} attached</p></div><time>{new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol>
        <div className="narration-card"><div><span className="eyebrow">Expert knowledge transfer</span><button className="mic-button" type="button" disabled={!canRecord} onClick={captureMicrophone} aria-label="Use microphone">⌁</button></div><textarea value={narration} onChange={(event) => setNarration(event.target.value)} placeholder="Explain the decision the way you would in a KT session..." disabled={!canRecord} /><button className="text-action" type="button" disabled={!canRecord || !narration.trim()} onClick={saveNarration}>Add to KT trail</button>{microphoneState === 'listening' && <p className="capture-feedback">Microphone ready - narration remains editable.</p>}{microphoneState === 'unavailable' && <p className="capture-feedback">Microphone unavailable - type your explanation instead.</p>}</div>
        <fieldset className="evidence-selector"><legend>Linked knowledge transfer materials</legend>{evidence.map((item) => <label key={item.id}><input type="checkbox" checked={selectedEvidenceIds.includes(item.id)} onChange={() => setSelectedEvidenceIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /> <span>{item.title}</span></label>)}</fieldset>
      </aside>
    </section>

    <section className="decision-dock"><div><span className="eyebrow">Expert disposition</span><h2>What should happen to this invoice?</h2><p>Select the outcome you would make today. Tacit records the decision together with every source you reviewed.</p></div><div className="decision-options">{workspace.outcomes.map((outcome) => <button className={`decision-card ${observation.decision === outcome.id ? 'is-selected' : ''}`} key={outcome.id} disabled={!canRecord} onClick={() => chooseDecision(outcome.id)}><strong>{outcome.label}</strong><small>{outcome.id === 'approve' ? 'Within the observed tolerance' : outcome.id === 'escalate' ? 'Hold for a higher-risk review' : 'Record this expert outcome'}</small></button>)}</div><button className="complete-observation" disabled={!canRecord || !observation.decision || completionState === 'saving'} onClick={() => { void completeSession(); }}>{completionState === 'saving' ? 'Building workflow...' : 'Finish observation →'}</button></section>
    {error && <section role="alert" className="notice"><p>We could not complete this observation. Your recorded steps are still available.</p><button className="btn btn-secondary" type="button" onClick={() => { void completeSession(); }}>Retry</button><button className="btn btn-danger" type="button" onClick={resetDemo}>Reset demo</button></section>}
    <ObservationTimelineView events={observation.events} actions={workspace.actions} evidence={evidence} narration={observation.session.narration} />
  </WorkspaceShell>;
}

function Fields({ fields, values }: { readonly fields: readonly { id: string; label: string }[]; readonly values: Readonly<Record<string, string | number | boolean | null>> }) {
  return <dl className="data-list">{fields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{valueText(values[field.id])}</dd></div>)}</dl>;
}
