import { invoiceExceptionSeedData } from '@tacit/workflow-invoice-exception';
import { DemoOverview } from '../features/demo/demo-overview';

export default function HomePage() {
  return <DemoOverview projectId={invoiceExceptionSeedData.project.id} projectName={invoiceExceptionSeedData.project.name} metrics={[
    { label: 'Workflow version', value: 'Draft v1' }, { label: 'Latest build', value: 'Awaiting build' },
    { label: 'Test score', value: '12 / 12 after repair' }, { label: 'Safe automation coverage', value: '70%' },
  ]} />;
}
