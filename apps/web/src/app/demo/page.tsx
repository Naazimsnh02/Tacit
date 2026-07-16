import { invoiceExceptionSeedData } from '@tacit/workflow-invoice-exception';
import { DemoOverview } from '../../features/demo/demo-overview';
export default function DemoPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED === 'false') return <main className="mode-entry"><section className="mode-entry-card"><h1>Demo mode is disabled.</h1><p className="muted">Ask an administrator to enable the explicit demo feature flag.</p></section></main>;
  return <DemoOverview projectId={invoiceExceptionSeedData.project.id} projectName={invoiceExceptionSeedData.project.name} metrics={[{ label: 'Workflow version', value: 'Draft v1' }, { label: 'Latest build', value: 'Awaiting build' }, { label: 'Test score', value: '12 / 12 after repair' }, { label: 'Safe automation coverage', value: '70%' }]} />;
}
