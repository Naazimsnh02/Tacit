import type { ObservationSession, WorkflowEvent } from '@tacit/core-schemas';
import type { ObservationRepository } from './service';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

/** Server-only persistence adapter shared by manual and automatic observations. */
export class SupabaseObservationRepository implements ObservationRepository {
  private readonly connection = config();

  private async request(path: string, body: unknown) {
    const response = await fetch(`${this.connection.url}/rest/v1/${path}`, {
      method: 'POST',
      headers: { apikey: this.connection.key, Authorization: `Bearer ${this.connection.key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Unable to save the observation.');
  }

  async saveSession(session: ObservationSession): Promise<void> {
    await this.request('observation_sessions', [{ id: session.id, project_id: session.projectId, status: session.status, started_at: session.startedAt, completed_at: session.completedAt, narration: session.narration, created_at: session.createdAt }]);
  }

  async saveEvents(events: readonly WorkflowEvent[]): Promise<void> {
    await this.request('workflow_events', events.map((event) => ({ id: event.id, observation_session_id: event.observationSessionId, source: event.source, action: event.action, occurred_at: event.occurredAt, payload: event.payload, evidence_ids: event.evidenceIds })));
  }
}
