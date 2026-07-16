'use client';

import { useState } from 'react';
import { RecoverableError } from '../demo/recoverable-error';
import { StatusBadge } from '../demo/status-badge';

interface ProgressEvent { readonly stage: string; readonly message: string }
interface BuildComplete { readonly buildId: string; readonly promotionStatus: 'pending' }

function accessToken(): string | null {
  try { return (JSON.parse(window.sessionStorage.getItem('tacit.production.session') ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null; } catch { return null; }
}

export function BuildConsole({ projectId, workflowVersionId }: { readonly projectId: string; readonly workflowVersionId: string }) {
  const [events, setEvents] = useState<readonly ProgressEvent[]>([]);
  const [state, setState] = useState<'idle' | 'building' | 'complete' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [build, setBuild] = useState<BuildComplete | null>(null);

  async function startBuild() {
    const token = accessToken(); if (!token) { setState('error'); setMessage('Sign in to compile a production workflow.'); return; }
    setEvents([]); setMessage(null); setBuild(null); setState('building');
    try {
      const response = await fetch(`/api/projects/${projectId}/builds`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workflowVersionId }) });
      if (!response.ok || !response.body) throw new Error('Unable to start the agent build.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = '';
      while (true) {
        const { done, value } = await reader.read(); pending += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const frames = pending.split('\n\n'); pending = frames.pop() ?? '';
        for (const frame of frames) {
          const event = frame.match(/^event: (.+)$/m)?.[1]; const raw = frame.match(/^data: (.+)$/m)?.[1]; if (!event || !raw) continue;
          const data = JSON.parse(raw) as ProgressEvent & Partial<BuildComplete> & { error?: string };
          if (event === 'progress') setEvents((current) => [...current, data]);
          if (event === 'complete' && data.buildId && data.promotionStatus === 'pending') { setBuild({ buildId: data.buildId, promotionStatus: data.promotionStatus }); setState('complete'); setMessage('Build passed static analysis and generated tests. Review and explicitly promote it before replay.'); }
          if (event === 'error') { setState('error'); setMessage(data.error ?? 'Unable to compile the agent.'); }
        }
        if (done) break;
      }
    } catch (error) { setState('error'); setMessage(error instanceof Error ? error.message : 'Unable to compile the agent.'); }
  }

  async function promoteBuild() {
    const token = accessToken(); if (!token || !build) { setMessage('Sign in to promote this build.'); return; }
    try {
      const response = await fetch(`/api/projects/${projectId}/builds/${build.buildId}/promote`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? 'Unable to promote this build.');
      setMessage('Build promoted. Historical replay can now use it.'); setBuild(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to promote this build.'); }
  }

  const status = state === 'building' ? 'building' : state === 'complete' ? 'ready_to_build' : state === 'error' ? 'tests_failed' : 'draft';
  return <section className="stack"><section className="card"><div className="card-header"><div><h2>Build console</h2><p className="muted">Compile confirmed workflow rules into constrained, reviewable artifacts.</p></div><div className="header-actions"><StatusBadge status={status} /><button className="btn btn-primary" type="button" onClick={() => { void startBuild(); }} disabled={state === 'building'}>{state === 'building' ? 'Building…' : 'Build agent'}</button></div></div>{message && state !== 'error' ? <p className="status status-info" role="status">{message}</p> : null}{build ? <button className="btn btn-secondary" type="button" onClick={() => { void promoteBuild(); }}>Promote tested build</button> : null}{state === 'complete' && !build ? <a className="btn btn-secondary" href={`/projects/${projectId}/evaluations`}>Replay historical cases</a> : null}</section>{state === 'error' ? <RecoverableError message="The agent build did not finish. Retry the build or return to the confirmed workflow." onRetry={() => { void startBuild(); }} previousHref={`/workflow-versions/${workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}`} /> : null}<section className="card"><h2>Build activity</h2>{events.length === 0 ? <p className="empty">Start a build to stream Codex generation, validation, tests, and repair activity.</p> : <ol className="progress-list" aria-label="Build progress">{events.map((event, index) => <li key={`${event.stage}-${index}`}><div><strong>{event.stage}</strong><div className="muted">{event.message}</div></div></li>)}</ol>}</section></section>;
}
