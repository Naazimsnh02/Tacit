import { describe, expect, it } from 'vitest';
import type { WorkflowEvent } from '@tacit/core-schemas';
import { eventRelevantValues, semanticTimelineItems, timelineItems } from './observation-timeline';

const actions = [{ id: 'compare', label: 'Compare values', eventAction: 'compare_values', evidenceTypes: [], timelineStep: 'Applied tolerance rule' }];
const event = (id: string, occurredAt: string): WorkflowEvent => ({
  id, observationSessionId: '11111111-1111-4111-8111-111111111111', source: 'user', action: 'compare_values', occurredAt,
  payload: { fields: { invoiceQuantity: 98, poQuantity: 100 } }, evidenceIds: [],
});

describe('observation timeline', () => {
  it('renders stored events in chronological order with workflow-pack semantics', () => {
    const items = timelineItems([event('b', '2026-07-15T10:02:00.000Z'), event('a', '2026-07-15T10:01:00.000Z')], actions);
    expect(items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(items[0]).toMatchObject({ action: 'Compare values', semanticStep: 'Applied tolerance rule' });
  });

  it('groups adjacent low-level events into a semantic step', () => {
    expect(semanticTimelineItems([event('a', '2026-07-15T10:01:00.000Z'), event('b', '2026-07-15T10:02:00.000Z')], actions)[0].events).toHaveLength(2);
  });

  it('extracts relevant primitive field values without assuming a workflow domain', () => {
    expect(eventRelevantValues(event('a', '2026-07-15T10:01:00.000Z'))).toEqual(['invoiceQuantity: 98', 'poQuantity: 100']);
  });
});
