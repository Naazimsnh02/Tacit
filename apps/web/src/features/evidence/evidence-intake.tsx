'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrandLogo } from '../ui/brand-logo';
import { hasPendingEvidenceProcessing, hasReadyEvidence } from './evidence-refresh';
import { evidenceTypes, previewText, suggestedEvidenceType, type EvidenceType } from './evidence-intake-utils';

type Artifact = { readonly id: string; readonly displayName: string; readonly evidenceType: string; readonly byteSize: number; readonly status: string; readonly scanStatus: string; readonly createdAt: string; readonly failureReason: string | null; };
type Extraction = { readonly id: string; readonly artifactId: string; readonly kind: string; readonly content: string; readonly pageStart: number | null; readonly pageEnd: number | null; readonly timeStartMs: number | null; readonly timeEndMs: number | null; readonly confidence: number; };
type Session = { readonly accessToken: string };
type SelectedFile = { readonly id: string; readonly file: File; readonly evidenceType: EvidenceType };
type UploadProgress = { readonly completed: number; readonly total: number; readonly currentFileId: string; readonly percent: number };
const sessionKey = 'tacit.production.session';

function session(): Session | null { try { const value = window.sessionStorage.getItem(sessionKey); return value ? JSON.parse(value) as Session : null; } catch { return null; } }
async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> { const response = await fetch(path, { ...init, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } }); const body = response.status === 204 ? undefined : await response.json() as T & { error?: string }; if (!response.ok) throw new Error(body?.error ?? 'The request could not be completed.'); return body as T; }
function bytes(value: number): string { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`; }
function citation(extraction: Extraction): string { if (extraction.pageStart) return `p. ${extraction.pageStart}${extraction.pageEnd && extraction.pageEnd !== extraction.pageStart ? `-${extraction.pageEnd}` : ''}`; if (extraction.timeStartMs !== null) { const start = Math.floor(extraction.timeStartMs / 1000); const end = extraction.timeEndMs === null ? null : Math.floor(extraction.timeEndMs / 1000); return `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}${end !== null ? `-${Math.floor(end / 60)}:${String(end % 60).padStart(2, '0')}` : ''}`; } return 'source-wide'; }

function CustomDropdown({
  value,
  onChange,
  disabled,
}: {
  readonly value: EvidenceType;
  readonly onChange: (val: EvidenceType) => void;
  readonly disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const label = value === 'video' ? 'Review video' : value[0].toUpperCase() + value.slice(1);

  return (
    <div className={`custom-dropdown${isOpen ? ' is-open' : ''}`} ref={dropdownRef}>
      <button
        className="custom-dropdown-trigger"
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{label}</span>
        <span className="custom-dropdown-arrow" aria-hidden="true">▼</span>
      </button>
      {isOpen && (
        <ul className="custom-dropdown-menu" role="listbox">
          {evidenceTypes.map((type) => (
            <li
              key={type}
              role="option"
              aria-selected={type === value}
              className={`custom-dropdown-item${type === value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(type);
                setIsOpen(false);
              }}
            >
              {type === 'video' ? 'Review video' : type[0].toUpperCase() + type.slice(1)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EvidenceIntake({ projectId }: { readonly projectId: string }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [understanding, setUnderstanding] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const token = useMemo(() => typeof window === 'undefined' ? null : session()?.accessToken ?? null, []);
  const canUnderstand = hasReadyEvidence(artifacts, extractions.length);
  const refresh = useCallback(async () => {
    if (!token) return;
    const data = await api<{ artifacts: Artifact[]; extractions: Extraction[] }>(`/api/projects/${projectId}/evidence`, token);
    setArtifacts(data.artifacts); setExtractions(data.extractions);
  }, [projectId, token]);

  useEffect(() => { void refresh().catch((error: Error) => setMessage(error.message)); }, [refresh]);
  useEffect(() => {
    if (!hasPendingEvidenceProcessing(artifacts)) return;
    const interval = window.setInterval(() => { void refresh().catch((error: Error) => setMessage(error.message)); }, 3_000);
    return () => window.clearInterval(interval);
  }, [artifacts, refresh]);

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
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to upload this evidence.'); }
    finally { setProgress(null); setBusy(false); }
  }

  async function remove(artifactId: string) {
    if (!token || !window.confirm('Delete this source file and its extracted evidence?')) return;
    setBusy(true); setMessage(null);
    try { await api(`/api/projects/${projectId}/evidence/${artifactId}`, token, { method: 'DELETE' }); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete this evidence.'); }
    finally { setBusy(false); }
  }

  async function understandProcess() {
    if (!token || !canUnderstand) return;
    setUnderstanding(true);
    window.location.assign(`/projects/${projectId}/understand`);
  }

  if (!token) return <main className="production-page"><section className="card"><h1>Sign in to start knowledge transfer</h1><p className="muted">Knowledge transfer intake is available only in an authenticated project.</p><a className="btn btn-primary" href="/projects">Go to projects</a></section></main>;

  return <main className="production-page">
    <header className="production-header"><a className="brand" href="/projects" aria-label="Tacit projects"><BrandLogo /></a></header>
    <section className="production-intro"><div><p className="eyebrow">Knowledge transfer workspace</p><h1>Run a knowledge transfer session with Tacit.</h1><p className="muted">Hand over how the work is done the way you would to a new teammate: SOPs, records, exports, screenshots, walkthroughs, and expert notes. Once the KT package is ready, Tacit prepares a cited workflow draft and asks only the decisions it cannot resolve safely.</p></div><div className="header-actions"><button className="btn btn-primary" disabled={!canUnderstand || understanding} title={canUnderstand ? undefined : 'Wait for a clean, completed extraction before Tacit can prepare the workflow from this knowledge transfer.'} type="button" onClick={() => { void understandProcess(); }}>{understanding ? 'Preparing workflow from KT...' : 'Understand this process'}</button><a className="btn btn-ghost" href={`/projects/${projectId}/observe`}>Add live expert KT</a></div></section>
    {message ? <p className="notice" role="alert">{message}</p> : null}
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
          {canUnderstand ? `${extractions.length} KT segments ready` : 'Preparing knowledge transfer materials'}
        </span>
      </div>
      {artifacts.length ? (
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
                        {artifact.evidenceType} · {bytes(artifact.byteSize)} · {new Date(artifact.createdAt).toLocaleString()}
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
                  className="btn btn-ghost"
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
  </main>;
}
