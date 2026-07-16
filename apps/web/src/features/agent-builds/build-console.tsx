'use client';

import { useState } from 'react';
import { RecoverableError } from '../demo/recoverable-error';
import { StatusBadge } from '../demo/status-badge';

interface ProgressEvent { readonly stage: string; readonly message: string }

export function BuildConsole({ projectId, workflowVersionId }: { readonly projectId: string; readonly workflowVersionId: string }) {
  const [events, setEvents] = useState<readonly ProgressEvent[]>([]);
  const [state, setState] = useState<'idle' | 'building' | 'complete' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function startBuild() {
    setEvents([]); setMessage(null); setState('building');
    try {
      const response = await fetch(`/api/projects/${projectId}/builds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflowVersionId }) });
      if (!response.ok || !response.body) throw new Error('Unable to start the agent build.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = '';
      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const frames = pending.split('\n\n'); pending = frames.pop() ?? '';
        for (const frame of frames) {
          const event = frame.match(/^event: (.+)$/m)?.[1]; const raw = frame.match(/^data: (.+)$/m)?.[1];
          if (!event || !raw) continue;
          const data = JSON.parse(raw) as ProgressEvent & { error?: string };
          if (event === 'progress') setEvents((current) => [...current, data]);
          if (event === 'complete') { setState('complete'); setMessage('Build complete. Generated tests await restricted execution.'); }
          if (event === 'error') { setState('error'); setMessage(data.error ?? 'Unable to compile the agent.'); }
        }
        if (done) break;
      }
    } catch (error) { setState('error'); setMessage(error instanceof Error ? error.message : 'Unable to compile the agent.'); }
  }

  return <section>
    <h1>Agent build</h1><p>Compile the confirmed workflow into constrained, reviewable artifacts.</p>
    <button type="button" onClick={() => { void startBuild(); }} disabled={state === 'building'}>{state === 'building' ? 'Building…' : 'Build agent'}</button>
    <p><StatusBadge status={state === 'building' ? 'building' : state === 'complete' ? 'ready_to_build' : state === 'error' ? 'tests_failed' : 'draft'} /></p>
    {state === 'error' ? <RecoverableError message="The agent build did not finish. Retry the build or return to the confirmed workflow." onRetry={() => { void startBuild(); }} previousHref={`/workflow-versions/${workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}`} /> : message ? <p role="status">{message}</p> : null}
    {state === 'complete' ? <p><a href={`/projects/${projectId}/evaluations`}>Replay historical cases</a></p> : null}
    <ol aria-label="Build progress">{events.map((event, index) => <li key={`${event.stage}-${index}`}><strong>{event.stage}</strong>: {event.message}</li>)}</ol>
  </section>;
}
