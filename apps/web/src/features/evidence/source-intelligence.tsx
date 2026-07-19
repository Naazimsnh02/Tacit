'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader, WorkspaceShell } from '../ui/app-shell';

type Insight = { id: string; kind: string; content: string; entityType: string | null; entityValue: string | null; confidence: number; extractionIds: string[] };
type Relationship = { id: string; type: string; rationale: string; confidence: number };
type Job = { id: string; kind: string; status: string; error_message: string | null };
const sessionKey = 'tacit.production.session';
function token() { try { return (JSON.parse(window.sessionStorage.getItem(sessionKey) ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null; } catch { return null; } }

export function SourceIntelligence({ projectId }: { readonly projectId: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const accessToken = useMemo(() => token(), []);
  const automaticallyQueued = useRef(false);
  const refresh = useCallback(async () => {
    if (!accessToken) return;
    const response = await fetch(`/api/projects/${projectId}/sources/insights`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    const body = await response.json() as { insights?: Insight[]; relationships?: Relationship[]; jobs?: Job[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? 'Unable to load source intelligence.');
    setInsights(body.insights ?? []); setRelationships(body.relationships ?? []); setJobs(body.jobs ?? []);
  }, [accessToken, projectId]);
  const start = useCallback(async () => {
    if (!accessToken) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/sources/insights`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json() as { status?: 'queued' | 'already_processed'; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to queue source intelligence.');
      setMessage(body.status === 'already_processed' ? 'This exact knowledge transfer package is already interpreted. Add or replace a source to run a new version.' : 'Tacit is interpreting sources, frames, transcripts, and their connections.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to queue source intelligence.'); }
    finally { setBusy(false); }
  }, [accessToken, projectId, refresh]);
  const prepareWorkflow = useCallback(async () => {
    if (!accessToken || !insights.length || jobs.some((job) => job.status === 'queued' || job.status === 'running')) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/understand`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json() as { workflowVersionId?: string; error?: string };
      if (!response.ok || !body.workflowVersionId) throw new Error(body.error ?? 'Tacit could not prepare a workflow.');
      window.location.assign(`/workflow-versions/${body.workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Tacit could not prepare a workflow.'); setBusy(false); }
  }, [accessToken, insights.length, jobs, projectId]);

  useEffect(() => { void refresh().catch((error: Error) => setMessage(error.message)); }, [refresh]);
  useEffect(() => { if (!jobs.some((job) => job.status === 'queued' || job.status === 'running')) return; const interval = window.setInterval(() => { void refresh().catch(() => undefined); }, 3_000); return () => window.clearInterval(interval); }, [jobs, refresh]);
  useEffect(() => { if (!automaticallyQueued.current && !busy && !insights.length && !jobs.length) { automaticallyQueued.current = true; void start(); } }, [busy, insights.length, jobs.length, start]);

  const processing = jobs.some((job) => job.status === 'queued' || job.status === 'running');
  const canPrepareWorkflow = insights.length > 0 && !processing;
  return <WorkspaceShell active="Understand" mode="production" projectId={projectId}>
    <PageHeader breadcrumb="Understand" title="What Tacit learned from the knowledge transfer" description="Tacit interprets every source before proposing a cited workflow." actions={<>
      <button className="btn btn-primary" disabled={busy || processing} onClick={() => void start()}>{busy || processing ? 'Interpreting…' : 'Refresh understanding'}</button>
      {canPrepareWorkflow ? <button className="btn btn-secondary" disabled={busy} onClick={() => void prepareWorkflow()}>Prepare workflow</button> : <a className="btn btn-secondary" href={`/projects/${projectId}/evidence`}>Manage KT materials</a>}
    </>} />
    {message ? <p className="notice" role="status">{message}</p> : null}
    <section className="metric-grid">
      <article className="card metric-card"><dt className="metric-label">Cited insights</dt><dd className="metric-value">{insights.length}</dd><p className="metric-context">Stored against immutable extracts</p></article>
      <article className="card metric-card"><dt className="metric-label">Source relationships</dt><dd className="metric-value">{relationships.length}</dd><p className="metric-context">Supports, conflicts, and shared entities</p></article>
      <article className="card metric-card"><dt className="metric-label">Understanding jobs</dt><dd className="metric-value">{jobs.filter((job) => job.status === 'queued' || job.status === 'running').length}</dd><p className="metric-context">Background, retryable processing</p></article>
    </section>
    <section className="split">
      <article className="card"><h2>What Tacit learned from the KT</h2>{insights.length ? <div className="stack">{insights.map((insight) => <article className="evidence-row" key={insight.id}><div><span className="status status-info">{insight.kind.replaceAll('_', ' ')}</span><strong> {insight.entityValue ?? 'Source insight'}</strong><p>{insight.content}</p><p className="muted">{Math.round(insight.confidence * 100)}% confidence · {insight.extractionIds.length} cited segment{insight.extractionIds.length === 1 ? '' : 's'}</p></div></article>)}</div> : <p className="empty">Tacit queues source intelligence automatically once clean extracted sources are available.</p>}</article>
      <article className="card"><h2>Connections and conflicts</h2>{relationships.length ? <ul className="list-compact">{relationships.map((relationship) => <li key={relationship.id}><strong>{relationship.type}</strong> · {relationship.rationale} <span className="muted">({Math.round(relationship.confidence * 100)}%)</span></li>)}</ul> : <p className="empty">Cross-source links and contradictions appear once interpretation finishes.</p>}<h3 style={{ marginTop: 24 }}>Processing history</h3>{jobs.length ? <ul className="list-compact">{jobs.map((job) => <li key={job.id}><span className={`status ${job.status === 'failed' ? 'status-danger' : job.status === 'succeeded' ? 'status-success' : 'status-info'}`}>{job.status}</span> {job.kind.replaceAll('_', ' ')}{job.error_message ? ` - ${job.error_message}` : ''}</li>)}</ul> : <p className="muted">Waiting for source intelligence to be queued.</p>}</article>
    </section>
  </WorkspaceShell>;
}
