import { describe, expect, it, vi } from 'vitest';
import { loadObservation, newObservation, observationStorageKey, restoreObservation } from './observation-state';

describe('observation state', () => {
  it('creates a generic persisted observation session', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '99999999-9999-4999-8999-999999999999' });
    const observation = newObservation('11111111-1111-4111-8111-111111111111', new Date('2026-07-15T09:00:00.000Z'));
    expect(observation.session.status).toBe('recording');
    expect(observationStorageKey(observation.session.projectId)).toBe('tacit:observation:11111111-1111-4111-8111-111111111111');
    expect(restoreObservation(JSON.stringify(observation))).toEqual(observation);
    vi.unstubAllGlobals();
  });

  it('ignores invalid persisted values', () => {
    expect(restoreObservation('{not-json')).toBeNull();
  });

  it('creates a new observation when nothing has been restored yet', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '88888888-8888-4888-8888-888888888888' });
    const observation = loadObservation('22222222-2222-4222-8222-222222222222', null, new Date('2026-07-15T09:15:00.000Z'));
    expect(observation.session.projectId).toBe('22222222-2222-4222-8222-222222222222');
    expect(observation.session.status).toBe('recording');
    vi.unstubAllGlobals();
  });
});
