export const demoStages = [
  'overview', 'observe', 'discover', 'workflow', 'build', 'test', 'approvals', 'impact',
] as const;

export type DemoStage = (typeof demoStages)[number];

export const demoStageLabels: Readonly<Record<DemoStage, string>> = {
  overview: 'Overview', observe: 'Observe', discover: 'Discover', workflow: 'Workflow',
  build: 'Build', test: 'Test', approvals: 'Approvals', impact: 'Impact',
};

export interface DemoProgress { readonly started: boolean; readonly stage: DemoStage; }

export const demoProgressStorageKey = 'tacit.demo.progress.v1';

export function parseDemoProgress(value: string | null): DemoProgress {
  if (!value) return { started: false, stage: 'overview' };
  try {
    const candidate = JSON.parse(value) as Partial<DemoProgress>;
    if (typeof candidate.started === 'boolean' && typeof candidate.stage === 'string' && demoStages.includes(candidate.stage as DemoStage)) {
      return { started: candidate.started, stage: candidate.stage as DemoStage };
    }
  } catch { /* A malformed local value must never block the demo. */ }
  return { started: false, stage: 'overview' };
}

export function nextDemoStage(stage: DemoStage): DemoStage {
  const index = demoStages.indexOf(stage);
  return demoStages[Math.min(index + 1, demoStages.length - 1)] ?? 'impact';
}
