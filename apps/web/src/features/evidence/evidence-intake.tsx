'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, WorkspaceShell } from '../ui/app-shell';
import { tabCache } from '../../lib/tab-cache';
import { CustomSelect } from '../ui/custom-select';
import { hasPendingEvidenceProcessing, hasReadyEvidence } from './evidence-refresh';
import { evidenceTypes, previewText, suggestedEvidenceType, type EvidenceType } from './evidence-intake-utils';

type Artifact = { readonly id: string; readonly displayName: string; readonly evidenceType: string; readonly byteSize: number; readonly status: string; readonly scanStatus: string; readonly createdAt: string; readonly failureReason: string | null; };
type Extraction = { readonly id: string; readonly artifactId: string; readonly kind: string; readonly content: string; readonly pageStart: number | null; readonly pageEnd: number | null; readonly timeStartMs: number | null; readonly timeEndMs: number | null; readonly confidence: number; };
type IntelligenceJob = { readonly id: string; readonly kind: string; readonly status: string };
type Session = { readonly accessToken: string };
type SelectedFile = { readonly id: string; readonly file: File; readonly evidenceType: EvidenceType };
type UploadProgress = { readonly completed: number; readonly total: number; readonly currentFileId: string; readonly percent: number };
const sessionKey = 'tacit.production.session';

function session(): Session | null { try { const value = window.sessionStorage.getItem(sessionKey); return value ? JSON.parse(value) as Session : null; } catch { return null; } }
async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> { const response = await fetch(path, { ...init, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } }); const body = response.status === 204 ? undefined : await response.json() as T & { error?: string }; if (!response.ok) throw new Error(body?.error ?? 'The request could not be completed.'); return body as T; }
function bytes(value: number): string { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`; }
function citation(extraction: Extraction): string { if (extraction.pageStart) return `p. ${extraction.pageStart}${extraction.pageEnd && extraction.pageEnd !== extraction.pageStart ? `-${extraction.pageEnd}` : ''}`; if (extraction.timeStartMs !== null) { const start = Math.floor(extraction.timeStartMs / 1000); const end = extraction.timeEndMs === null ? null : Math.floor(extraction.timeEndMs / 1000); return `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}${end !== null ? `-${Math.floor(end / 60)}:${String(end % 60).padStart(2, '0')}` : ''}`; } return 'source-wide'; }

function formatEvidenceType(type: string): string {
  if (type === 'sop') return 'SOP';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function CustomDropdown({
  value,
  onChange,
  disabled,
}: {
  readonly value: EvidenceType;
  readonly onChange: (val: EvidenceType) => void;
  readonly disabled?: boolean;
}) {
  return (
    <CustomSelect
      value={value}
      disabled={disabled}
      onChange={(val) => onChange(val as EvidenceType)}
      options={evidenceTypes.map((type) => ({
        value: type,
        label: type === 'video' ? 'Review video' : formatEvidenceType(type),
      }))}
    />
  );
}

export function EvidenceIntake({ projectId }: { readonly projectId: string }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [intelligenceJobs, setIntelligenceJobs] = useState<IntelligenceJob[]>([]);
  const [insightCount, setInsightCount] = useState(0);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [understanding, setUnderstanding] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useMemo(() => typeof window === 'undefined' ? null : session()?.accessToken ?? null, []);
  const canUnderstand = hasReadyEvidence(artifacts, extractions.length);
  const intelligenceProcessing = intelligenceJobs.some((job) => job.status === 'queued' || job.status === 'running');
  const hasUnderstanding = insightCount > 0 || intelligenceJobs.some((job) => job.status === 'succeeded' || job.status === 'queued' || job.status === 'running');
  
  const refresh = useCallback(async (isBackground = false) => {
    if (!token) return;
    const cacheKeyEvidence = `${projectId}/evidence`;
    const cacheKeyInsights = `${projectId}/sources/insights`;
    
    if (!isBackground) {
      const cachedEvidence = tabCache.get<{ artifacts: Artifact[]; extractions: Extraction[] }>(cacheKeyEvidence);
      const cachedInsights = tabCache.get<{ insights: unknown[]; jobs: IntelligenceJob[] }>(cacheKeyInsights);
      if (cachedEvidence) {
        setArtifacts(cachedEvidence.artifacts);
        setExtractions(cachedEvidence.extractions);
        setLoading(false);
      }
      if (cachedInsights) {
        setInsightCount(cachedInsights.insights.length);
        setIntelligenceJobs(cachedInsights.jobs);
      }
    }
    
    try {
      const [data, intelligence] = await Promise.all([
        api<{ artifacts: Artifact[]; extractions: Extraction[] }>(`/api/projects/${projectId}/evidence`, token),
        api<{ insights: unknown[]; jobs: IntelligenceJob[] }>(`/api/projects/${projectId}/sources/insights`, token).catch(() => ({ insights: [] as unknown[], jobs: [] as IntelligenceJob[] })),
      ]);
      setArtifacts(data.artifacts);
      setExtractions(data.extractions);
      setInsightCount(intelligence.insights.length);
      setIntelligenceJobs(intelligence.jobs);
      
      tabCache.set(cacheKeyEvidence, data);
      tabCache.set(cacheKeyInsights, intelligence);
    } catch (error) {
      const cachedEvidence = tabCache.get(cacheKeyEvidence);
      if (!cachedEvidence) {
        throw error;
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [projectId, token]);

  useEffect(() => { void refresh(false).catch((error: Error) => setMessage(error.message)); }, [refresh]);
  useEffect(() => {
    if (!hasPendingEvidenceProcessing(artifacts) && !intelligenceProcessing) return;
    const interval = window.setInterval(() => { void refresh(true).catch((error: Error) => setMessage(error.message)); }, 3_000);
    return () => window.clearInterval(interval);
  }, [artifacts, intelligenceProcessing, refresh]);

  function selectFiles(selected: FileList | null) {
    const batch = Array.from(selected ?? []).map((file, index) => ({ id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${index}`, file, evidenceType: suggestedEvidenceType(file) }));
    if (batch.length) setFiles((current) => [...current, ...batch]);
  }

  function updateEvidenceType(fileId: string, evidenceType: EvidenceType) { setFiles((current) => current.map((item) => item.id === fileId ? { ...item, evidenceType } : item)); }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token || !files.length || !consent) return;
    setBusy(true); setMessage(null);
    const failed = new Set<string>(); const failures: string[] = []; let completed = 0;
    try {
      for (const selected of files) {
        setProgress({ completed, total: files.length, currentFileId: selected.id, percent: 0 });
        try {
          const digest = await crypto.subtle.digest('SHA-256', await selected.file.arrayBuffer());
          const checksumSha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
          const created = await api<{ artifact: Artifact; signedUrl: string }>(`/api/projects/${projectId}/evidence`, token, { method: 'POST', body: JSON.stringify({ evidenceType: selected.evidenceType, filename: selected.file.name, mediaType: selected.file.type, byteSize: selected.file.size, checksumSha256, processingConsent: true, retentionDays: 365 }) });
          await new Promise<void>((resolve, reject) => { const request = new XMLHttpRequest(); request.open('PUT', created.signedUrl); request.setRequestHeader('Content-Type', selected.file.type); request.upload.onprogress = (value) => { if (value.lengthComputable) setProgress({ completed, total: files.length, currentFileId: selected.id, percent: Math.round((value.loaded / value.total) * 100) }); }; request.onerror = () => reject(new Error('The direct upload failed. Please retry.')); request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('The direct upload was rejected. Please retry.')); request.send(selected.file); });
          await api(`/api/projects/${projectId}/evidence/${created.artifact.id}/complete`, token, { method: 'POST', body: JSON.stringify({ checksumSha256 }) });
          completed += 1;
        } catch (error) { failed.add(selected.id); failures.push(`${selected.file.name}: ${error instanceof Error ? error.message : 'Upload failed.'}`); }
      }
      setFiles((current) => current.filter((item) => failed.has(item.id)));
      setConsent(failed.size > 0);
      setMessage(failed.size ? `${completed} of ${files.length} files were queued. Keep the ${failed.size} unsuccessful file${failed.size === 1 ? '' : 's'} selected, adjust it if needed, and retry. ${failures.join(' ')}` : `${completed} files were verified and queued for malware scanning and evidence extraction.`);
      tabCache.clearAllForProject(projectId);
      await refresh(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to upload this evidence.'); }
    finally { setProgress(null); setBusy(false); }
  }

  async function remove(artifactId: string) {
    if (!token || !window.confirm('Delete this source file and its extracted evidence?')) return;
    setBusy(true); setMessage(null);
    try {
      await api(`/api/projects/${projectId}/evidence/${artifactId}`, token, { method: 'DELETE' });
      tabCache.clearAllForProject(projectId);
      await refresh(true);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete this evidence.'); }
    finally { setBusy(false); }
  }

  async function understandProcess() {
    if (!token || !canUnderstand) return;
    setUnderstanding(true);
    // Navigate only: the Understand page resumes existing jobs and does not re-queue an unchanged package.
    window.location.assign(`/projects/${projectId}/understand`);
  }

  const understandLabel = understanding
    ? 'Opening understanding…'
    : intelligenceProcessing
      ? 'View interpretation progress'
      : hasUnderstanding
        ? 'View understanding'
        : 'Understand this process';

  if (!token) {
    return (
      <WorkspaceShell active="Sources" mode="production" projectId={projectId}>
        <PageHeader breadcrumb="Sources" title="Sign in to start knowledge transfer" description="Knowledge transfer intake is available only in an authenticated project." />
        <section className="card">
          <p className="muted">Open Projects to sign in, then return to this knowledge transfer session.</p>
          <a className="btn btn-primary" href="/projects">Go to projects</a>
        </section>
      </WorkspaceShell>
    );
  }

  return <WorkspaceShell active="Sources" mode="production" projectId={projectId}>
    <PageHeader
      breadcrumb="Sources"
      title="Knowledge transfer materials"
      description="Hand over how the work is done the way you would to a new teammate. Sources stay here; use the left workspace steps to continue without restarting interpretation."
      actions={<>
        <button
          className="btn btn-primary"
          disabled={!canUnderstand || understanding}
          title={canUnderstand ? (hasUnderstanding ? 'Open the Understand step. Unchanged packages will not re-run interpretation.' : undefined) : 'Wait for a clean, completed extraction before Tacit can prepare the workflow from this knowledge transfer.'}
          type="button"
          onClick={() => { void understandProcess(); }}
        >
          {understandLabel}
        </button>
        <a className="btn btn-secondary" href={`/projects/${projectId}/observe`}>Add live expert KT</a>
      </>}
    />
    {message ? <p className="notice" role="alert">{message}</p> : null}
    {hasUnderstanding ? (
      <p className="notice" role="status">
        {intelligenceProcessing
          ? 'Source interpretation is already in progress. Opening Understand resumes that run; it does not start from scratch unless you add or replace a source.'
          : `Source interpretation already has ${insightCount} insight${insightCount === 1 ? '' : 's'}. Opening Understand shows the results; re-runs only happen if the extraction set changes.`}
      </p>
    ) : null}
    <section className="production-grid">
      <article className="card">
        <h2>Upload the knowledge transfer package</h2>
        <p className="muted">
          Add the materials an expert would share in a KT session: SOPs, records, exports, screenshots, walkthroughs, and related process files. Each source is independently verified and queued for extraction.
        </p>
        <form className="stack" onSubmit={upload}>
          <label>
            <span className="field-label">Files</span>
            <input
              className="input"
              type="file"
              multiple
              disabled={busy || understanding}
              onChange={(event) => {
                selectFiles(event.target.files);
                event.currentTarget.value = '';
              }}
            />
          </label>
          {files.length ? (
            <div className="upload-queue" aria-label="Selected files">
              {files.map((selected) => (
                <article
                  className={`upload-file${progress?.currentFileId === selected.id ? ' is-uploading' : ''}`}
                  key={selected.id}
                >
                  <div className="upload-file-main">
                    <strong>{selected.file.name}</strong>
                    <span>
                      {bytes(selected.file.size)}
                      {progress?.currentFileId === selected.id ? ` · ${progress.percent}%` : ''}
                    </span>
                  </div>
                  <label>
                    <span className="sr-only">Evidence type for {selected.file.name}</span>
                    <CustomDropdown
                      value={selected.evidenceType}
                      disabled={busy || understanding}
                      onChange={(value) => updateEvidenceType(selected.id, value)}
                    />
                  </label>
                  <button
                    aria-label={`Remove ${selected.file.name}`}
                    className="btn btn-ghost"
                    disabled={busy || understanding}
                    type="button"
                    onClick={() => setFiles((current) => current.filter((item) => item.id !== selected.id))}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty compact-empty">
              Choose one or more knowledge transfer files. Tacit suggests a type for each, and you can change it before upload.
            </p>
          )}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy || understanding}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              I have permission to upload these knowledge transfer materials and consent to Tacit processing them for workflow extraction.
            </span>
          </label>
          {progress !== null ? (
            <p className="muted">
              Uploading {progress.completed + 1} of {progress.total}: {progress.percent}%
            </p>
          ) : null}
          <button
            className="btn btn-primary"
            disabled={busy || understanding || !files.length || !consent}
            type="submit"
          >
            {busy
              ? `Uploading ${progress ? `${progress.completed + 1} of ${progress.total}` : 'files'}...`
              : files.length
                ? `Upload ${files.length} file${files.length === 1 ? '' : 's'} and queue extraction`
                : 'Upload files and queue extraction'}
          </button>
        </form>
      </article>
      <article className="card">
        <h2>What the knowledge transfer covers</h2>
        <p className="muted">
          Document text and tables, screenshots and forms, spoken explanations, and walkthrough frames are preserved as cited source segments. The first workflow draft uses every clean segment from this KT package.
        </p>
        <p className="muted">
          Need to capture unwritten context live? Use <strong>Add live expert KT</strong> for the advanced observation workspace, the way you would complete a handoff with a colleague in the room.
        </p>
      </article>
    </section>
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Knowledge transfer materials</h2>
          <p className="muted">
            Each extracted passage retains a page or timestamp citation tied to the immutable source. Processing state is visible before Tacit prepares the workflow.
          </p>
        </div>
        <span className={`status ${canUnderstand ? 'status-success' : 'status-info'}`}>
          {canUnderstand ? `${extractions.length} KT segments ready` : 'Preparing KT materials'}
        </span>
      </div>
      {loading ? (
        <div className="evidence-list">
          {Array.from({ length: 2 }).map((_, i) => (
            <article className="evidence-row" key={i}>
              <div className="evidence-row-content">
                <div className="evidence-row-heading" style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '4px', flexShrink: 0 }} />
                  <div style={{ flex: 1, marginLeft: '12px' }}>
                    <div className="skeleton" style={{ width: '150px', height: '14px', marginBottom: '8px' }} />
                    <div className="skeleton" style={{ width: '220px', height: '10px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '80px', height: '24px', borderRadius: '999px', flexShrink: 0 }} />
                </div>
                <div style={{ marginTop: '16px' }}>
                  <div className="skeleton" style={{ width: '100%', height: '12px', marginBottom: '6px' }} />
                  <div className="skeleton" style={{ width: '90%', height: '12px' }} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : artifacts.length ? (
        <div className="evidence-list">
          {artifacts.map((artifact) => {
            const artifactExtractions = extractions.filter((extraction) => extraction.artifactId === artifact.id);
            return (
              <article className="evidence-row" key={artifact.id}>
                <div className="evidence-row-content">
                  <div className="evidence-row-heading">
                    <div className="evidence-file-mark" aria-hidden="true">
                      {artifact.evidenceType.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{artifact.displayName}</strong>
                      <p className="muted">
                        {formatEvidenceType(artifact.evidenceType)} · {bytes(artifact.byteSize)} · {new Date(artifact.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`status ${
                        artifact.status === 'ready'
                          ? 'status-success'
                          : artifact.status === 'failed'
                            ? 'status-danger'
                            : 'status-info'
                      }`}
                    >
                      {artifact.status.charAt(0).toUpperCase() + artifact.status.slice(1)}
                    </span>
                  </div>
                  {artifact.failureReason ? <p className="notice">{artifact.failureReason}</p> : null}
                  {artifactExtractions.length ? (
                    <div className="evidence-extractions">
                      {artifactExtractions.map((extraction) => (
                        <details className="evidence-preview" key={extraction.id}>
                          <summary>
                            <span className="evidence-preview-meta">
                              {extraction.kind} · {citation(extraction)} · {Math.round(extraction.confidence * 100)}%
                            </span>
                            <span className="evidence-preview-copy">{previewText(extraction.content)}</span>
                          </summary>
                          <p>{extraction.content}</p>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <p className="muted evidence-pending">
                      {artifact.status === 'failed'
                        ? 'No extract was created for this source.'
                        : 'Extraction preview will appear here when processing finishes.'}
                    </p>
                  )}
                </div>
                <button
                  className="btn btn-secondary"
                  disabled={busy || understanding}
                  type="button"
                  onClick={() => void remove(artifact.id)}
                >
                  Delete
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty">No knowledge transfer materials have been uploaded to this project yet.</p>
      )}
    </section>
  </WorkspaceShell>;
}
