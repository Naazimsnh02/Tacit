'use client';

import { useEffect, useState } from 'react';

interface Result { id: string; test_case_id: string; actual_outcome: Record<string, unknown> | null; match_category: string | null; applied_rule_ids: string[]; evidence_ids: string[]; confidence: number | null; failure_explanation: string | null; suggested_next_step: string | null; test_cases: { label: string; input: Record<string, unknown>; expected_outcome: Record<string, unknown> }; }
export default function TestRunResultsPage({ params }: { readonly params: Promise<{ testRunId: string }> }) {
  const [results, setResults] = useState<readonly Result[] | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void params.then(async ({ testRunId }) => { const response = await fetch(`/api/test-runs/${testRunId}/results`); if (!response.ok) { setError('Unable to load replay results.'); return; } setResults(await response.json() as Result[]); }); }, [params]);
  if (error) return <main><p role="alert">{error}</p></main>;
  if (!results) return <main>Loading replay results…</main>;
  return <main><h1>Replay case inspection</h1>{results.map((result) => <article key={result.id}><h2>{result.match_category ?? 'Unclassified'} — {result.test_cases.label}</h2><p>Input data: {JSON.stringify(result.test_cases.input)}</p><p>Expected action: {JSON.stringify(result.test_cases.expected_outcome)}</p><p>Agent action: {JSON.stringify(result.actual_outcome)}</p><p>Applied rules: {result.applied_rule_ids.join(', ') || 'None recorded'}</p><p>Evidence: {result.evidence_ids.join(', ') || 'No case evidence'}</p><p>Confidence: {result.confidence ?? '—'}</p>{result.failure_explanation ? <p>Failure explanation: {result.failure_explanation}</p> : null}{result.suggested_next_step ? <p>Suggested next step: {result.suggested_next_step}</p> : null}</article>)}</main>;
}
