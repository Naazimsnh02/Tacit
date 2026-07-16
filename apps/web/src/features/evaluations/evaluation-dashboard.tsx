'use client';

import { useState } from 'react';
import type { EvaluationMetrics } from '../../lib/evaluations/service';
import { RecoverableError } from '../demo/recoverable-error';
import { StatusBadge } from '../demo/status-badge';

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
  async function replay() {
    setRunning(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/evaluations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const body = await response.json() as { testRunId?: string; metrics?: EvaluationMetrics; error?: string };
      if (!response.ok || !body.metrics || !body.testRunId) throw new Error(body.error ?? 'Unable to replay historical cases.');
      setMetrics(body.metrics); setRunId(body.testRunId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to replay historical cases.'); }
    finally { setRunning(false); }
  }
  return <section>
    <h1>Historical replay</h1>
    <p>Replay labelled historical cases against the latest successful generated build.</p>
    <button type="button" disabled={running} onClick={() => { void replay(); }}>{running ? 'Replaying…' : 'Replay historical cases'}</button>
    {running ? <p role="status">Running the ten seeded historical cases and comparing evidence-backed outcomesâ€¦</p> : null}
    {error ? <RecoverableError message="Historical replay could not be completed." onRetry={() => { void replay(); }} /> : null}
    {metrics ? <dl aria-label="Evaluation metrics">{metricLabels.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{key.includes('Rate') || key.includes('Coverage') ? `${metrics[key]}%` : metrics[key] ?? '—'}</dd></div>)}</dl> : null}
    {metrics ? <p><StatusBadge status={metrics.incorrectCases > 0 ? 'tests_failed' : 'verified'} /></p> : null}
    {runId ? <a href={`/test-runs/${runId}`}>Inspect replay results</a> : null}
  </section>;
}
