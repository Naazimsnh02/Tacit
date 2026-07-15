import type { ObservationSession, WorkflowEvent } from '@tacit/core-schemas';

export interface StoredObservation {
  readonly session: ObservationSession;
  readonly events: readonly WorkflowEvent[];
  readonly decision: string | null;
  readonly notes: string;
}

export function observationStorageKey(projectId: string): string {
  return `tacit:observation:${projectId}`;
}

export function newObservation(projectId: string, now = new Date()): StoredObservation {
  const startedAt = now.toISOString();
  return {
    session: { id: crypto.randomUUID(), projectId, status: 'recording', startedAt, completedAt: null, narration: null, createdAt: startedAt },
    events: [], decision: null, notes: '',
  };
}

export function restoreObservation(value: string | null): StoredObservation | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoredObservation;
    return parsed.session && Array.isArray(parsed.events) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadObservation(projectId: string, storedValue: string | null, now = new Date()): StoredObservation {
  return restoreObservation(storedValue) ?? newObservation(projectId, now);
}
