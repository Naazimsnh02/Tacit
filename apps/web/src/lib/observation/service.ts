import { observationSessionSchema, workflowEventSchema, type ObservationSession, type WorkflowEvent } from '@tacit/core-schemas';

export interface ObservationRepository {
  saveSession(session: ObservationSession): Promise<void>;
  saveEvents(events: readonly WorkflowEvent[]): Promise<void>;
}

export class ObservationPersistenceError extends Error {}

/** Persists a completed, domain-neutral observation before workflow reconstruction. */
export async function persistCompletedObservation(input: {
  projectId: string; session: ObservationSession; events: readonly WorkflowEvent[]; repository: ObservationRepository;
}): Promise<void> {
  const session = observationSessionSchema.parse(input.session);
  if (session.projectId !== input.projectId) throw new ObservationPersistenceError('The observation session does not belong to this project.');
  if (session.status !== 'completed' || !session.completedAt) throw new ObservationPersistenceError('Complete the observation before continuing.');
  const events = input.events.map((event) => workflowEventSchema.parse(event));
  if (!events.length) throw new ObservationPersistenceError('Record at least one workflow event before continuing.');
  if (events.some((event) => event.observationSessionId !== session.id)) throw new ObservationPersistenceError('Observation events do not belong to this session.');
  await input.repository.saveSession(session);
  await input.repository.saveEvents(events);
}
