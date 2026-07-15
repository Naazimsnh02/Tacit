import type { WorkflowEvent } from '@tacit/core-schemas';
import type { WorkspaceActionDefinition } from '@tacit/workflow-sdk';

export interface TimelineItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly source: WorkflowEvent['source'];
  readonly action: string;
  readonly semanticStep: string;
  readonly events: readonly WorkflowEvent[];
}

function readableAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

export function timelineItems(
  events: readonly WorkflowEvent[],
  actions: readonly WorkspaceActionDefinition[],
): readonly TimelineItem[] {
  const actionByEvent = new Map(actions.map((action) => [action.eventAction, action]));
  return [...events]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .map((event) => {
      const definition = actionByEvent.get(event.action);
      return {
        id: event.id,
        occurredAt: event.occurredAt,
        source: event.source,
        action: definition?.label ?? readableAction(event.action),
        semanticStep: definition?.timelineStep ?? readableAction(event.action),
        events: [event],
      };
    });
}

export function semanticTimelineItems(
  events: readonly WorkflowEvent[],
  actions: readonly WorkspaceActionDefinition[],
): readonly TimelineItem[] {
  return timelineItems(events, actions).reduce<TimelineItem[]>((items, item) => {
    const previous = items.at(-1);
    if (previous && previous.semanticStep === item.semanticStep && previous.source === item.source) {
      items[items.length - 1] = { ...previous, events: [...previous.events, ...item.events] };
    } else {
      items.push(item);
    }
    return items;
  }, []);
}

export function eventRelevantValues(event: WorkflowEvent): readonly string[] {
  const fields = event.payload.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return [];
  return Object.entries(fields)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => `${key}: ${String(value)}`);
}
