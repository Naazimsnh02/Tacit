'use client';

import { DemoControls } from './demo-controls';
import { StatusBadge, type ProductStatus } from './status-badge';

interface OverviewMetric { readonly label: string; readonly value: string; }

export function DemoOverview({ projectId, projectName, metrics, status = 'needs_clarification' }: { readonly projectId: string; readonly projectName: string; readonly metrics: readonly OverviewMetric[]; readonly status?: ProductStatus }) {
  const links = [
    ['Overview', '/'], ['Observe', `/projects/${projectId}/observe`], ['Discover', `/projects/${projectId}/observe`], ['Workflow', `/projects/${projectId}/observe`],
    ['Build', `/projects/${projectId}/observe`], ['Test', `/projects/${projectId}/evaluations`], ['Approvals', `/projects/${projectId}/approvals`], ['Impact', `/projects/${projectId}/impact`],
  ] as const;
  return <main style={{ minHeight: '100vh', background: '#f5f7fb', color: '#172033', fontFamily: 'Arial, sans-serif', padding: 32 }}>
    <header style={{ maxWidth: 1120, margin: '0 auto 28px', display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}><div><p style={{ margin: 0, color: '#59657a' }}>Tacit / Demo workspace</p><h1 style={{ margin: '6px 0' }}>{projectName}</h1><StatusBadge status={status} /></div><DemoControls stage="overview" /></header>
    <nav aria-label="Project navigation" style={{ maxWidth: 1120, margin: '0 auto 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>{links.map(([label, href]) => <a key={label} href={href} style={{ padding: '8px 10px', borderRadius: 8, background: label === 'Overview' ? '#233d85' : 'white', color: label === 'Overview' ? 'white' : '#172033', textDecoration: 'none' }}>{label}</a>)}</nav>
    <section style={{ maxWidth: 1120, margin: '0 auto', background: 'white', border: '1px solid #dde3ef', borderRadius: 12, padding: 24 }}><h2>Demo readiness</h2><p>Follow the guided path to observe expert work, clarify the decision boundary, compile the agent, verify it, and review a high-risk case.</p><dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>{metrics.map((metric) => <div key={metric.label} style={{ background: '#f7f9fd', padding: 16, borderRadius: 8 }}><dt style={{ color: '#59657a' }}>{metric.label}</dt><dd style={{ margin: '6px 0 0', fontWeight: 700, fontSize: 20 }}>{metric.value}</dd></div>)}</dl><p style={{ marginTop: 24 }}><a href={`/projects/${projectId}/observe`}>Begin observation</a></p></section>
  </main>;
}
