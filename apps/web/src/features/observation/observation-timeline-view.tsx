'use client';

import type { WorkflowEvent } from '@tacit/core-schemas';
import type { WorkspaceActionDefinition } from '@tacit/workflow-sdk';
import { useMemo, useState } from 'react';
import { eventRelevantValues, semanticTimelineItems, timelineItems, type TimelineItem } from './observation-timeline';

interface EvidenceOption { readonly id: string; readonly title: string; }

interface ObservationTimelineViewProps {
  readonly events: readonly WorkflowEvent[];
  readonly actions: readonly WorkspaceActionDefinition[];
  readonly evidence: readonly EvidenceOption[];
  readonly narration: string | null;
}

function displayTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function payloadText(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : null;
}

export function ObservationTimelineView({ events, actions, evidence, narration }: ObservationTimelineViewProps) {
  const [view, setView] = useState<'semantic' | 'raw'>('semantic');
  const [source, setSource] = useState<'all' | WorkflowEvent['source']>('all');
  const [selected, setSelected] = useState<TimelineItem | null>(null);
  const filteredEvents = useMemo(() => source === 'all' ? events : events.filter((event) => event.source === source), [events, source]);
  const items = useMemo(() => view === 'semantic' ? semanticTimelineItems(filteredEvents, actions) : timelineItems(filteredEvents, actions), [actions, filteredEvents, view]);
  const selectedEvent = selected?.events.at(-1) ?? null;
  const selectedEvidence = selectedEvent ? evidence.filter((item) => selectedEvent.evidenceIds.includes(item.id)) : [];

  return <section style={{ maxWidth: 1500, margin: '16px auto 0', display: 'grid', gridTemplateColumns: selectedEvent ? 'minmax(0, 1fr) minmax(300px, .55fr)' : '1fr', gap: 16 }}>
    <Panel title="Observation timeline">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setView('semantic')} aria-pressed={view === 'semantic'}>Semantic steps</button>
        <button onClick={() => setView('raw')} aria-pressed={view === 'raw'}>Raw events</button>
        <label style={{ marginLeft: 8 }}>Source <select value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="all">All sources</option><option value="user">User</option><option value="system">System</option><option value="import">Import</option></select></label>
      </div>
      {items.length === 0 ? <p style={{ color: '#59657a', margin: 0 }}>Recorded actions will appear here as the observation progresses.</p> : <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => <li key={item.id} style={{ borderTop: '1px solid #edf0f5' }}><button onClick={() => setSelected(item)} style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', padding: '12px 0', textAlign: 'left', color: '#172033' }}><strong>{displayTime(item.occurredAt)}</strong> <span style={{ color: '#59657a' }}>— {view === 'semantic' ? item.semanticStep : item.action}</span><br /><small>{item.source} · {item.events.length} event{item.events.length === 1 ? '' : 's'}</small></button></li>)}
      </ol>}
    </Panel>
    {selectedEvent && <Panel title="Evidence detail">
      <p><strong>Action:</strong> {selected?.action}</p>
      <p><strong>Semantic step:</strong> {selected?.semanticStep}</p>
      <p><strong>Relevant values:</strong> {eventRelevantValues(selectedEvent).join(' · ') || 'None recorded'}</p>
      <p><strong>Evidence:</strong> {selectedEvidence.length ? selectedEvidence.map((item) => item.title).join(', ') : 'None linked'}</p>
      <p><strong>Transcript:</strong> {payloadText(selectedEvent.payload.narration) ?? narration ?? 'No narration recorded'}</p>
      <p><strong>Before / after:</strong> {payloadText(selectedEvent.payload.before) ?? 'Not recorded'} / {payloadText(selectedEvent.payload.after) ?? 'Not recorded'}</p>
      <details><summary>Raw event JSON</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(selectedEvent, null, 2)}</pre></details>
    </Panel>}
  </section>;
}

function Panel({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return <section style={{ background: 'white', border: '1px solid #dde3ef', borderRadius: 12, padding: 18, boxShadow: '0 1px 3px #17203312' }}><h2 style={{ fontSize: 18, marginTop: 0 }}>{title}</h2>{children}</section>;
}
