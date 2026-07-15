import { describe, expect, it } from 'vitest';
import { ObservationPersistenceError, persistCompletedObservation, type ObservationRepository } from './service';

const projectId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const event = { id: '33333333-3333-4333-8333-333333333333', observationSessionId: sessionId, source: 'user' as const, action: 'complete_review', occurredAt: '2026-07-15T09:02:00.000Z', payload: {}, evidenceIds: [] };
class Repository implements ObservationRepository { sessions = 0; events = 0; async saveSession() { this.sessions += 1; } async saveEvents(value: readonly typeof event[]) { this.events += value.length; } }

describe('observation persistence', () => {
  it('persists a completed session and its domain-neutral event stream', async () => {
    const repository = new Repository();
    await persistCompletedObservation({ projectId, repository, events: [event], session: { id: sessionId, projectId, status: 'completed', startedAt: '2026-07-15T09:00:00.000Z', completedAt: '2026-07-15T09:02:00.000Z', narration: null, createdAt: '2026-07-15T09:00:00.000Z' } });
    expect(repository.sessions).toBe(1); expect(repository.events).toBe(1);
  });
  it('does not persist an incomplete observation', async () => {
    await expect(persistCompletedObservation({ projectId, repository: new Repository(), events: [event], session: { id: sessionId, projectId, status: 'recording', startedAt: '2026-07-15T09:00:00.000Z', completedAt: null, narration: null, createdAt: '2026-07-15T09:00:00.000Z' } })).rejects.toBeInstanceOf(ObservationPersistenceError);
  });
});
