'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader, WorkspaceShell } from '../../../features/ui/app-shell';
import { productionHeaders } from '../../../features/projects/production-api';
import { tabCache } from '../../../lib/tab-cache';

interface Result { id: string; test_case_id: string; actual_outcome: Record<string, unknown> | null; match_category: string | null; applied_rule_ids: string[]; evidence_ids: string[]; confidence: number | null; failure_explanation: string | null; suggested_next_step: string | null; test_cases: { label: string; input: Record<string, unknown>; expected_outcome: Record<string, unknown> }; }

export default function TestRunResultsPage({ params }: { readonly params: Promise<{ testRunId: string }> }) {
  const [results, setResults] = useState<readonly Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const projectId = useSearchParams().get('projectId');

  useEffect(() => {
    void params.then(async ({ testRunId }) => {
      const cacheKey = `${testRunId}/results`;
      const cached = tabCache.get<Result[]>(cacheKey);
      if (cached) {
        setResults(cached);
      }

      try {
        const response = await fetch(`/api/test-runs/${testRunId}/results`, { headers: productionHeaders() });
        if (!response.ok) {
          throw new Error('Unable to load replay results.');
        }
        const data = await response.json() as Result[];
        setResults(data);
        tabCache.set(cacheKey, data);
      } catch (err: unknown) {
        if (!cached) {
          setError(err instanceof Error ? err.message : 'Unable to load replay results.');
        }
      }
    });
  }, [params]);

  return (
    <WorkspaceShell active="Test" mode="production" projectId={projectId ?? undefined}>
      <PageHeader
        breadcrumb="Test / Replay results"
        title="Replay case inspection"
        description="Compare expected and actual decisions with their applied rules and evidence."
        actions={projectId ? <a className="btn btn-secondary" href={`/projects/${projectId}/evaluations`}>Back to replay</a> : undefined}
      />
      {error ? (
        <section className="notice" role="alert">
          <p>{error}</p>
        </section>
      ) : !results ? (
        <section className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Result</th>
                <th>Expected</th>
                <th>Agent action</th>
                <th>Evidence & confidence</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td>
                    <div className="skeleton" style={{ width: '120px', height: '16px', marginBottom: '8px' }} />
                    <div className="skeleton" style={{ width: '70px', height: '12px' }} />
                  </td>
                  <td>
                    <div className="skeleton" style={{ width: '80px', height: '20px', borderRadius: '999px' }} />
                  </td>
                  <td>
                    <div className="skeleton" style={{ width: '100px', height: '14px' }} />
                  </td>
                  <td>
                    <div className="skeleton" style={{ width: '100px', height: '14px' }} />
                  </td>
                  <td>
                    <div className="skeleton" style={{ width: '60px', height: '16px', marginBottom: '4px' }} />
                    <div className="skeleton" style={{ width: '100px', height: '12px' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Result</th>
                <th>Expected</th>
                <th>Agent action</th>
                <th>Evidence & confidence</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <td>
                    <strong>{result.test_cases.label}</strong>
                    <details>
                      <summary>View input</summary>
                      <pre className="json">{JSON.stringify(result.test_cases.input, null, 2)}</pre>
                    </details>
                  </td>
                  <td>
                    <span className={`status ${result.match_category === 'incorrect' ? 'status-danger' : result.match_category?.includes('clarification') ? 'status-warning' : 'status-success'}`}>
                      {result.match_category ?? 'Unclassified'}
                    </span>
                    {result.failure_explanation ? <p className="muted">{result.failure_explanation}</p> : null}
                    {result.suggested_next_step ? <p className="muted">Next: {result.suggested_next_step}</p> : null}
                  </td>
                  <td>
                    <pre className="json">{JSON.stringify(result.test_cases.expected_outcome, null, 2)}</pre>
                  </td>
                  <td>
                    <pre className="json">{JSON.stringify(result.actual_outcome, null, 2)}</pre>
                  </td>
                  <td>
                    <strong>{result.confidence === null ? '—' : `${Math.round(result.confidence * 100)}%`}</strong>
                    <div className="muted">Rules: {result.applied_rule_ids.join(', ') || 'None'}</div>
                    <div className="muted">Evidence: {result.evidence_ids.join(', ') || 'None'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </WorkspaceShell>
  );
}
