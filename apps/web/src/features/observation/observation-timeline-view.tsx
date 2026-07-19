'use client';

import type { WorkflowEvent } from '@tacit/core-schemas';
import type { WorkspaceActionDefinition } from '@tacit/workflow-sdk';
import { useMemo, useState } from 'react';
import { eventRelevantValues, semanticTimelineItems, timelineItems, type TimelineItem } from './observation-timeline';
import { CustomSelect } from '../ui/custom-select';

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

  return <section className="split" style={{ marginTop: 16, gridTemplateColumns: selectedEvent ? undefined : '1fr' }}>
    <Panel title="Observation timeline">
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className="tab" onClick={() => setView('semantic')} aria-pressed={view === 'semantic'}>Semantic steps</button>
        <button className="tab" onClick={() => setView('raw')} aria-pressed={view === 'raw'}>Raw events</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 0 auto' }}>
          <span className="field-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Source</span>
          <CustomSelect
            value={source}
            onChange={(value) => setSource(value as typeof source)}
            options={[
              { value: 'all', label: 'All sources' },
              { value: 'user', label: 'User' },
              { value: 'system', label: 'System' },
              { value: 'import', label: 'Import' },
            ]}
            align="right"
            style={{ width: 120 }}
          />
        </div>
      </div>
      {items.length === 0 ? <p className="empty">Recorded actions will appear here as the observation progresses.</p> : <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => <li key={item.id}><button className="timeline-item" onClick={() => setSelected(item)}><strong>{displayTime(item.occurredAt)}</strong> <span className="muted">· {view === 'semantic' ? item.semanticStep : item.action}</span><br /><small>{item.source} · {item.events.length} event{item.events.length === 1 ? '' : 's'}</small></button></li>)}
      </ol>}
    </Panel>
    {selectedEvent && <Panel title="Evidence detail">
      <p><strong>Action:</strong> {selected?.action}</p>
      <p><strong>Semantic step:</strong> {selected?.semanticStep}</p>
      <p><strong>Relevant values:</strong> {eventRelevantValues(selectedEvent).join(' · ') || 'None recorded'}</p>
      <p><strong>Evidence:</strong> {selectedEvidence.length ? selectedEvidence.map((item) => item.title).join(', ') : 'None linked'}</p>
      <p><strong>Transcript:</strong> {payloadText(selectedEvent.payload.narration) ?? narration ?? 'No narration recorded'}</p>
      <p><strong>Before / after:</strong> {payloadText(selectedEvent.payload.before) ?? 'Not recorded'} / {payloadText(selectedEvent.payload.after) ?? 'Not recorded'}</p>
      <details><summary>Raw event JSON</summary><pre className="json">{JSON.stringify(selectedEvent, null, 2)}</pre></details>
    </Panel>}
  </section>;
}

function Panel({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return <section className="card"><h2>{title}</h2>{children}</section>;
}
