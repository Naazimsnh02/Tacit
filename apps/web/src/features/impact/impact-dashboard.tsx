'use client';

import type { ImpactMetrics } from '@tacit/core-schemas';
import { useEffect, useState } from 'react';

type NumericImpactMetric = 'manualSteps' | 'automatedSteps' | 'aiAssistedSteps' | 'humanRequiredSteps' | 'manualHandlingMinutes' | 'estimatedAutomatedMinutes' | 'automationCoveragePercent' | 'reviewRatePercent' | 'rulesDiscovered' | 'undocumentedExceptions' | 'accuracyPercent' | 'estimatedMinutesSaved';
const metrics: ReadonlyArray<[NumericImpactMetric, string, boolean]> = [
  ['manualSteps', 'Manual steps', false], ['automatedSteps', 'Automated steps', false], ['aiAssistedSteps', 'AI-assisted steps', false], ['humanRequiredSteps', 'Human-required steps', false],
  ['manualHandlingMinutes', 'Manual handling time', false], ['estimatedAutomatedMinutes', 'Estimated assisted time', false], ['automationCoveragePercent', 'Safe automation coverage', true], ['reviewRatePercent', 'Human review rate', true],
  ['rulesDiscovered', 'Rules discovered', false], ['undocumentedExceptions', 'Undocumented exceptions', false], ['accuracyPercent', 'Historical test accuracy', true], ['estimatedMinutesSaved', 'Estimated minutes saved', false],
];
export function ImpactDashboard({ projectId }: { readonly projectId: string }) {
  const [snapshot, setSnapshot] = useState<ImpactMetrics | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void fetch(`/api/projects/${projectId}/impact`).then(async (response) => { const body = await response.json() as ImpactMetrics | { error: string }; if (!response.ok || !('capturedAt' in body)) throw new Error('error' in body ? body.error : 'Unable to load impact metrics.'); setSnapshot(body); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load impact metrics.')); }, [projectId]);
  if (error) return <main><p role="alert">{error}</p></main>; if (!snapshot) return <main>Loading stored impact metrics…</main>;
  return <main><h1>Impact dashboard</h1><p>Stored snapshot captured {new Date(snapshot.capturedAt).toLocaleString()}.</p><dl aria-label="Impact metrics">{metrics.map(([key, label, percent]) => <div key={key}><dt>{label} <small>({snapshot.sources[String(key)] ?? 'estimated'})</small></dt><dd>{snapshot[key]}{percent ? '%' : key.includes('Minutes') ? ' min' : ''}</dd></div>)}</dl><h2>Assumptions</h2><ul>{snapshot.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></main>;
}
