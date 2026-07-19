'use client';

import type { ImpactMetrics } from '@tacit/core-schemas';
import { useEffect, useState } from 'react';
import { productionHeaders } from '../projects/production-api';
import { tabCache } from '../../lib/tab-cache';

type NumericImpactMetric = 'manualSteps' | 'automatedSteps' | 'aiAssistedSteps' | 'humanRequiredSteps' | 'manualHandlingMinutes' | 'estimatedAutomatedMinutes' | 'automationCoveragePercent' | 'reviewRatePercent' | 'rulesDiscovered' | 'undocumentedExceptions' | 'accuracyPercent' | 'estimatedMinutesSaved';
const metrics: ReadonlyArray<[NumericImpactMetric, string, boolean]> = [['manualSteps', 'Manual steps', false], ['automatedSteps', 'Automated steps', false], ['aiAssistedSteps', 'AI-assisted steps', false], ['humanRequiredSteps', 'Human-required steps', false], ['manualHandlingMinutes', 'Manual handling time', false], ['estimatedAutomatedMinutes', 'Estimated assisted time', false], ['automationCoveragePercent', 'Safe automation coverage', true], ['reviewRatePercent', 'Human review rate', true], ['rulesDiscovered', 'Rules discovered', false], ['undocumentedExceptions', 'Undocumented exceptions', false], ['accuracyPercent', 'Historical test accuracy', true], ['estimatedMinutesSaved', 'Estimated minutes saved', false]];

export function ImpactDashboard({ projectId }: { readonly projectId: string }) {
  const [snapshot, setSnapshot] = useState<ImpactMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `${projectId}/impact`;
    const cached = tabCache.get<ImpactMetrics>(cacheKey);
    if (cached) {
      setSnapshot(cached);
    }

    void fetch(`/api/projects/${projectId}/impact`, { headers: productionHeaders() })
      .then(async (response) => {
        const body = await response.json() as ImpactMetrics | { error: string };
        if (!response.ok || !('capturedAt' in body)) throw new Error('error' in body ? body.error : 'Unable to load impact metrics.');
        setSnapshot(body);
        tabCache.set(cacheKey, body);
      })
      .catch((cause: unknown) => {
        if (!cached) {
          setError(cause instanceof Error ? cause.message : 'Unable to load impact metrics.');
        }
      });
  }, [projectId]);

  if (error) {
    return (
      <section className="notice" role="alert">
        <h2>Impact data unavailable</h2>
        <p>{error}</p>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="stack">
        <div className="card card-subtle" style={{ minHeight: '60px' }}>
          <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '320px', height: '12px' }} />
        </div>
        <div className="metric-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div className="card metric-card" key={i}>
              <div className="skeleton" style={{ width: '60%', height: '12px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '40%', height: '24px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '80%', height: '12px' }} />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="skeleton" style={{ width: '150px', height: '18px', marginBottom: '12px' }} />
          <div className="stack" style={{ gap: '8px' }}>
            <div className="skeleton" style={{ width: '100%', height: '14px' }} />
            <div className="skeleton" style={{ width: '90%', height: '14px' }} />
            <div className="skeleton" style={{ width: '95%', height: '14px' }} />
          </div>
        </div>
      </section>
    );
  }
  return <section className="stack"><section className="card card-subtle"><span className="metric-label">Impact snapshot</span><p className="muted">Captured {new Date(snapshot.capturedAt).toLocaleString()}. Each metric is labelled as observed from replay or estimated from stated assumptions.</p></section><dl className="metric-grid" aria-label="Impact metrics">{metrics.map(([key, label, percent]) => <div className="card metric-card" key={key}><dt className="metric-label">{label}</dt><dd className="metric-value">{snapshot[key]}{percent ? '%' : key.includes('Minutes') ? ' min' : ''}</dd><p className="metric-context">{snapshot.sources[String(key)] ?? 'estimated'}</p></div>)}</dl><section className="card"><h2>Calculation assumptions</h2><ul className="list-compact">{snapshot.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></section></section>;
}
