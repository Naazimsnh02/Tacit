'use client';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, WorkspaceShell } from '../ui/app-shell';
import { tabCache } from '../../lib/tab-cache';

const sessionKey = 'tacit.production.session';
function token() { try { return (JSON.parse(window.sessionStorage.getItem(sessionKey) ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null; } catch { return null; } }

export function OperatingWorkspace({ projectId }: { readonly projectId: string }) {
  const accessToken = useMemo(() => token(), []);
  const [readiness, setReadiness] = useState<{ mode: string; reasons: string[]; metrics: { replayAccuracy: number | null; unresolvedClarifications: number; openContradictions: number } } | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const cacheKey = `${projectId}/readiness`;
    const cached = tabCache.get<typeof readiness>(cacheKey);
    if (cached) {
      setReadiness(cached);
    }

    void fetch(`/api/projects/${projectId}/readiness`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (response) => {
        const body = await response.json() as typeof readiness & { error?: string };
        if (!response.ok) throw new Error(body.error);
        setReadiness(body);
        tabCache.set(cacheKey, body);
      })
      .catch((error: Error) => {
        if (!cached) {
          setMessage(error.message);
        }
      });
  }, [accessToken, projectId]);

  async function record() {
    if (!accessToken || !note.trim()) return;
    const response = await fetch(`/api/projects/${projectId}/operating-observations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'outcome', payload: { note: note.trim() } })
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(body.error ?? 'Unable to record this outcome.');
    } else {
      setNote('');
      setMessage('Operating feedback recorded. It cannot change the promoted workflow without a reviewed proposal.');
      // Invalidate cache since operating action was recorded
      tabCache.clearAllForProject(projectId);
    }
  }

  return (
    <WorkspaceShell active="Operate" mode="production" projectId={projectId}>
      <PageHeader
        breadcrumb="Operate"
        title="Run with supervision"
        description="Operating feedback becomes evidence for a reviewed workflow change; it never silently changes a promoted build."
      />
      {message ? <p className="notice" role="status">{message}</p> : null}
      
      <section className="card">
        <h2>Deployment readiness</h2>
        {readiness ? (
          <>
            <p>
              <span className="status status-info">{readiness.mode.replaceAll('_', ' ')}</span>
            </p>
            <ul className="list-compact">
              {readiness.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="muted">
              Replay accuracy: {readiness.metrics.replayAccuracy === null ? 'not yet available' : `${Math.round(readiness.metrics.replayAccuracy * 100)}%`} · Open clarifications: {readiness.metrics.unresolvedClarifications} · Open contradictions: {readiness.metrics.openContradictions}
            </p>
          </>
        ) : (
          <div className="stack" style={{ gap: '12px', padding: '12px 0' }}>
            <div className="skeleton" style={{ width: '120px', height: '24px', borderRadius: '12px' }} />
            <div className="stack" style={{ gap: '8px' }}>
              <div className="skeleton" style={{ width: '100%', height: '14px' }} />
              <div className="skeleton" style={{ width: '90%', height: '14px' }} />
              <div className="skeleton" style={{ width: '60%', height: '14px' }} />
            </div>
            <div className="skeleton" style={{ width: '280px', height: '14px', marginTop: '8px' }} />
          </div>
        )}
      </section>

      <section className="card">
        <h2>Record supervised outcome</h2>
        <p className="muted">
          Capture an override, unexpected outcome, or operational observation. Tacit will keep it separate from the active workflow until someone reviews a change proposal.
        </p>
        <textarea
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What happened, and what evidence should a reviewer inspect?"
        />
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" disabled={!note.trim()} onClick={() => void record()}>
            Record outcome
          </button>
        </div>
      </section>
    </WorkspaceShell>
  );
}
