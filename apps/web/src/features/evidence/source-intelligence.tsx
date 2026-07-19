'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, WorkspaceShell } from '../ui/app-shell';
import { tabCache } from '../../lib/tab-cache';

type Insight = { id: string; kind: string; content: string; entityType: string | null; entityValue: string | null; confidence: number; extractionIds: string[] };
type Relationship = { id: string; type: string; rationale: string; confidence: number };
type Job = { id: string; kind: string; status: string; error_message: string | null };
type QueueStatus = 'queued' | 'already_processed' | 'in_progress';
const sessionKey = 'tacit.production.session';
function token() { try { return (JSON.parse(window.sessionStorage.getItem(sessionKey) ?? 'null') as { accessToken?: string } | null)?.accessToken ?? null; } catch { return null; } }

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function queueMessage(status: QueueStatus): string {
  if (status === 'already_processed') {
    return 'This exact knowledge transfer package is already interpreted. Add or replace a source to run a new version.';
  }
  if (status === 'in_progress') {
    return 'Interpretation is already running for this package. Results will appear here as jobs finish; no new run was started.';
  }
  return 'Tacit is interpreting sources, extracting process structure, linking connections, and synthesizing the knowledge-transfer package.';
}

export function SourceIntelligence({ projectId }: { readonly projectId: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const accessToken = useMemo(() => token(), []);

  const refresh = useCallback(async (isBackground = false) => {
    if (!accessToken) return;
    const cacheKey = `${projectId}/sources/insights`;
    if (!isBackground) {
      const cached = tabCache.get<{ insights?: Insight[]; relationships?: Relationship[]; jobs?: Job[] }>(cacheKey);
      if (cached) {
        setInsights(cached.insights ?? []);
        setRelationships(cached.relationships ?? []);
        setJobs(cached.jobs ?? []);
        setLoaded(true);
      }
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/sources/insights`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      const body = await response.json() as { insights?: Insight[]; relationships?: Relationship[]; jobs?: Job[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to load source intelligence.');
      
      setInsights(body.insights ?? []);
      setRelationships(body.relationships ?? []);
      setJobs(body.jobs ?? []);
      setLoaded(true);
      
      tabCache.set(cacheKey, body);
    } catch (err: unknown) {
      const cached = tabCache.get(cacheKey);
      if (!cached) {
        throw err;
      }
    }
  }, [accessToken, projectId]);

  const start = useCallback(async (opts?: { manual?: boolean }) => {
    if (!accessToken) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/sources/insights`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json() as { status?: QueueStatus; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to queue source intelligence.');
      const status = body.status ?? 'queued';
      if (opts?.manual || status === 'queued') setMessage(queueMessage(status));
      else if (status === 'in_progress') setMessage(queueMessage(status));
      
      // Clear cache and refresh
      tabCache.clear(`${projectId}/sources/insights`);
      await refresh(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to queue source intelligence.');
    } finally {
      setBusy(false);
    }
  }, [accessToken, projectId, refresh]);

  const prepareWorkflow = useCallback(async () => {
    if (!accessToken || !insights.length || jobs.some((job) => job.status === 'queued' || job.status === 'running')) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/understand`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json() as { workflowVersionId?: string; error?: string };
      if (!response.ok || !body.workflowVersionId) throw new Error(body.error ?? 'Tacit could not prepare a workflow.');
      
      // Invalidate the cache for the project because a new workflow draft was prepared
      tabCache.clearAllForProject(projectId);
      
      window.location.assign(`/workflow-versions/${body.workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tacit could not prepare a workflow.');
      setBusy(false);
    }
  }, [accessToken, insights.length, jobs, projectId]);

  useEffect(() => {
    void refresh(false).catch((error: Error) => {
      setMessage(error.message);
      setLoaded(true);
    });
  }, [refresh]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === 'queued' || job.status === 'running')) return;
    const interval = window.setInterval(() => {
      void refresh(true).catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(interval);
  }, [jobs, refresh]);

  const processing = jobs.some((job) => job.status === 'queued' || job.status === 'running');
  const canPrepareWorkflow = insights.length > 0 && !processing;
  const primaryLabel = processing ? 'Interpreting…' : insights.length ? 'Check for package changes' : 'Start interpretation';

  return (
    <WorkspaceShell active="Understand" mode="production" projectId={projectId}>
      <PageHeader
        breadcrumb="Understand"
        title="What Tacit learned from the knowledge transfer"
        description="Tacit interprets every source before proposing a cited workflow. Unchanged packages are not re-run."
        actions={
          <>
            <button className="btn btn-primary" disabled={busy || processing} onClick={() => void start({ manual: true })}>
              {busy || processing ? 'Interpreting…' : primaryLabel}
            </button>
            {canPrepareWorkflow ? (
              <button className="btn btn-secondary" disabled={busy} onClick={() => void prepareWorkflow()}>
                Prepare workflow
              </button>
            ) : (
              <a className="btn btn-secondary" href={`/projects/${projectId}/evidence`}>
                Manage sources
              </a>
            )}
          </>
        }
      />
      <div className="stack" style={{ gap: '24px' }}>
        {message ? <p className="notice" role="status">{message}</p> : null}
        
        <section className="metric-grid-3">
          <article className="card metric-card no-line">
            <dt className="metric-label">Cited insights</dt>
            {loaded ? (
              <dd className="metric-value">{insights.length}</dd>
            ) : (
              <div className="skeleton" style={{ width: '40px', height: '30px', marginTop: '8px' }} />
            )}
            <p className="metric-context">Stored against immutable extracts</p>
          </article>
          <article className="card metric-card no-line">
            <dt className="metric-label">Source relationships</dt>
            {loaded ? (
              <dd className="metric-value">{relationships.length}</dd>
            ) : (
              <div className="skeleton" style={{ width: '40px', height: '30px', marginTop: '8px' }} />
            )}
            <p className="metric-context">Supports, conflicts, and shared entities</p>
          </article>
          <article className="card metric-card no-line">
            <dt className="metric-label">Understanding jobs</dt>
            {loaded ? (
              <dd className="metric-value">{jobs.filter((job) => job.status === 'queued' || job.status === 'running').length}</dd>
            ) : (
              <div className="skeleton" style={{ width: '40px', height: '30px', marginTop: '8px' }} />
            )}
            <p className="metric-context">Background, retryable processing</p>
          </article>
        </section>

        <section className="split">
          <article className="card">
            <h2>What Tacit learned from the KT</h2>
            {!loaded ? (
              <div className="stack" style={{ gap: '16px', padding: '12px 0' }}>
                <div className="skeleton" style={{ width: '90%', height: '54px' }} />
                <div className="skeleton" style={{ width: '85%', height: '54px' }} />
              </div>
            ) : insights.length ? (
              <div className="stack">
                {insights.map((insight) => (
                  <article className="evidence-row" key={insight.id}>
                    <div>
                      <span className="status status-info">{capitalize(insight.kind.replaceAll('_', ' '))}</span>
                      <strong> {insight.entityValue ?? 'Source insight'}</strong>
                      <p>{insight.content}</p>
                      <p className="muted">
                        {Math.round(insight.confidence * 100)}% confidence · {insight.extractionIds.length} cited segment{insight.extractionIds.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">
                {processing ? 'Interpretation is in progress. Cited insights appear here as each source finishes.' : 'Tacit queues source intelligence once clean extracted sources are available.'}
              </p>
            )}
          </article>

          <article className="card">
            <h2>Connections and conflicts</h2>
            {!loaded ? (
              <div className="stack" style={{ gap: '12px', padding: '12px 0' }}>
                <div className="skeleton" style={{ width: '85%', height: '14px' }} />
                <div className="skeleton" style={{ width: '90%', height: '14px' }} />
              </div>
            ) : relationships.length ? (
              <ul className="list-compact">
                {relationships.map((relationship) => (
                  <li key={relationship.id}>
                    <strong>{capitalize(relationship.type)}</strong> · {relationship.rationale}{' '}
                    <span className="muted">({Math.round(relationship.confidence * 100)}%)</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">
                {processing ? 'Cross-source links appear after source interpretation finishes.' : 'Cross-source links and contradictions appear once interpretation finishes.'}
              </p>
            )}

            <h3 style={{ marginTop: 24 }}>Processing history</h3>
            {!loaded ? (
              <div className="stack" style={{ gap: '12px', padding: '12px 0' }}>
                <div className="skeleton" style={{ width: '70%', height: '14px' }} />
                <div className="skeleton" style={{ width: '60%', height: '14px' }} />
              </div>
            ) : jobs.length ? (
              <ul className="list-compact">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <span className={`status ${job.status === 'failed' ? 'status-danger' : job.status === 'succeeded' ? 'status-success' : 'status-info'}`}>
                      {capitalize(job.status)}
                    </span>{' '}
                    {capitalize(job.kind.replaceAll('_', ' '))}
                    {job.error_message ? ` - ${job.error_message}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Waiting for source intelligence to be queued.</p>
            )}
          </article>
        </section>
      </div>
    </WorkspaceShell>
  );
}
