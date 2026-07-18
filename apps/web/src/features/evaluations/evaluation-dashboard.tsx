'use client';

import { useEffect, useState } from 'react';
import type { ApprovalRequest } from '@tacit/core-schemas';
import { parseHistoricalCaseCsv } from '../../lib/evaluations/historical-case-csv';
import type { EvaluationMetrics } from '../../lib/evaluations/service';
import { RecoverableError } from '../demo/recoverable-error';
import { StatusBadge } from '../demo/status-badge';
import { productionHeaders } from '../projects/production-api';

const metricLabels: ReadonlyArray<[keyof EvaluationMetrics, string]> = [
  ['totalCases', 'Total cases'], ['exactMatches', 'Exact matches'], ['acceptableAlternatives', 'Acceptable alternatives'],
  ['correctEscalations', 'Correct escalations'], ['incorrectCases', 'Incorrect cases'], ['needsClarification', 'Needs clarification'],
  ['safeAutomationCoverage', 'Safe automation coverage'], ['humanReviewRate', 'Human review rate'], ['unsafeFailureRate', 'Unsafe failure rate'], ['averageConfidence', 'Average confidence'],
];

export function EvaluationDashboard({ projectId }: { readonly projectId: string }) {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [caseCount, setCaseCount] = useState<number | null>(null);
  const [cases, setCases] = useState<readonly { id: string; label: string }[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [supervisedResult, setSupervisedResult] = useState<{ outcome: Record<string, unknown>; approval: ApprovalRequest | null } | null>(null);
  const [runningSupervised, setRunningSupervised] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function loadCases() {
    try {
      const response = await fetch(`/api/projects/${projectId}/test-cases`, { headers: productionHeaders() });
      const body = await response.json() as { count?: number; cases?: { id: string; label: string }[] };
      if (!response.ok || typeof body.count !== 'number') throw new Error('Unable to load historical cases.');
      setCaseCount(body.count);
      const loadedCases = body.cases ?? [];
      setCases(loadedCases);
      setSelectedCaseId((current) => current || loadedCases[0]?.id || '');
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Unable to load historical cases.'); }
  }

  useEffect(() => {
    void loadCases();
  }, [projectId]);

  async function replay() {
    setRunning(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/evaluations`, { method: 'POST', headers: productionHeaders({ 'Content-Type': 'application/json' }), body: '{}' });
      const body = await response.json() as { testRunId?: string; metrics?: EvaluationMetrics; error?: string };
      if (!response.ok || !body.metrics || !body.testRunId) throw new Error(body.error ?? 'Unable to replay historical cases.');
      setMetrics(body.metrics); setRunId(body.testRunId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to replay historical cases.'); } finally { setRunning(false); }
  }

  async function runSupervisedCase() {
    if (!selectedCaseId) return;
    setRunningSupervised(true); setError(null); setSupervisedResult(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/cases/execute`, {
        method: 'POST', headers: productionHeaders({ 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }),
        body: JSON.stringify({ testCaseId: selectedCaseId }),
      });
      const body = await response.json() as { outcome?: Record<string, unknown>; approval?: ApprovalRequest | null; error?: string };
      if (!response.ok || !body.outcome) throw new Error(body.error ?? 'Unable to run the supervised case.');
      setSupervisedResult({ outcome: body.outcome, approval: body.approval ?? null });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to run the supervised case.'); } finally { setRunningSupervised(false); }
  }

  async function importCases(file: File | null) {
    if (!file) return;
    setImporting(true); setImportMessage(null); setError(null);
    try {
      const cases = parseHistoricalCaseCsv(await file.text());
      const response = await fetch(`/api/projects/${projectId}/test-cases`, { method: 'POST', headers: productionHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ cases }) });
      const body = await response.json() as { imported?: number; error?: string };
      if (!response.ok || typeof body.imported !== 'number') throw new Error(body.error ?? 'Unable to import historical cases.');
      const imported = body.imported;
      await loadCases();
      setImportMessage(`${imported} labelled historical case${imported === 1 ? '' : 's'} imported with durable evidence links.`);
    } catch (cause) { setImportMessage(cause instanceof Error ? cause.message : 'Unable to import historical cases.'); } finally { setImporting(false); }
  }

  return <section className="stack">
    <section className="card">
      <div className="card-header"><div><h2>Historical replay</h2><p className="muted">Replay labelled, tenant-owned historical cases against the latest promoted generated build.</p></div><button className="btn btn-primary" type="button" disabled={running || caseCount === 0} title={caseCount === 0 ? 'Import labelled historical cases before replaying.' : undefined} onClick={() => { void replay(); }}>{running ? 'Replaying…' : 'Replay historical cases'}</button></div>
      {running ? <p className="status status-info" role="status">Running labelled project cases and comparing evidence-backed outcomes…</p> : null}
      {caseCount !== null ? <p className="muted">{caseCount} labelled historical case{caseCount === 1 ? '' : 's'} available for this project.</p> : null}
    </section>
    <section className="card">
      <div className="card-header"><div><h2>Run a supervised case</h2><p className="muted">Execute one evidence-linked case without changing replay results. A human-review outcome creates an approval request.</p></div><button className="btn btn-primary" type="button" disabled={runningSupervised || !selectedCaseId} onClick={() => { void runSupervisedCase(); }}>{runningSupervised ? 'Runningâ€¦' : 'Run case'}</button></div>
      <label><span className="field-label">Case</span><select className="input" value={selectedCaseId} disabled={runningSupervised || cases.length === 0} onChange={(event) => setSelectedCaseId(event.target.value)}>{cases.length === 0 ? <option value="">Import a labelled case first</option> : cases.map((testCase) => <option key={testCase.id} value={testCase.id}>{testCase.label}</option>)}</select></label>
      {supervisedResult ? <p className={supervisedResult.approval ? 'status status-info' : 'status status-success'} role="status">{supervisedResult.approval ? <>Approval request created. <a href={`/projects/${projectId}/approvals`}>Review it in Approvals</a>.</> : 'Case completed without requiring approval.'}</p> : null}
    </section>
    {caseCount !== null ? <section className="card"><h2>{caseCount === 0 ? 'Import labelled historical cases' : 'Import additional historical cases'}</h2><p className="muted">Use a CSV with <code>label</code>, <code>input_json</code>, <code>expected_outcome_json</code>, and <code>evidence_files</code>. Evidence files must exactly match ready files already uploaded to this project.</p><label><span className="field-label">Historical-case CSV</span><input className="input" type="file" accept=".csv,text/csv" disabled={importing} onChange={(event) => { void importCases(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label>{importMessage ? <p className="notice" role="status">{importMessage}</p> : null}</section> : null}
    {error ? <RecoverableError message={error} onRetry={() => { void replay(); }} /> : null}
    {metrics ? <section className="stack"><div className="header-actions" style={{ justifyContent: 'flex-start' }}><StatusBadge status={metrics.incorrectCases > 0 ? 'tests_failed' : 'verified'} />{runId ? <a className="btn btn-secondary" href={`/test-runs/${runId}?projectId=${encodeURIComponent(projectId)}`}>Inspect replay results</a> : null}</div><dl className="metric-grid" aria-label="Evaluation metrics">{metricLabels.map(([key, label]) => <div className="card metric-card" key={key}><dt className="metric-label">{label}</dt><dd className="metric-value">{key.includes('Rate') || key.includes('Coverage') ? `${metrics[key]}%` : metrics[key] ?? '—'}</dd><p className="metric-context">Latest replay</p></div>)}</dl></section> : null}
  </section>;
}
