'use client';

import { useEffect, useState } from 'react';
import { demoProgressStorageKey, demoStageLabels, nextDemoStage, parseDemoProgress, type DemoStage } from './demo-state';

export function DemoControls({ stage, onReset, onStart }: { readonly stage: DemoStage; readonly onReset?: () => void; readonly onStart?: () => void }) {
  const [started, setStarted] = useState(false);
  const [currentStage, setCurrentStage] = useState<DemoStage>(stage);

  useEffect(() => {
    const progress = parseDemoProgress(window.localStorage.getItem(demoProgressStorageKey));
    setStarted(progress.started); setCurrentStage(progress.stage);
  }, []);

  function save(progress: { started: boolean; stage: DemoStage }) {
    window.localStorage.setItem(demoProgressStorageKey, JSON.stringify(progress));
    setStarted(progress.started); setCurrentStage(progress.stage);
  }

  function reset() {
    window.localStorage.removeItem(demoProgressStorageKey);
    onReset?.();
    window.location.assign('/');
  }

  return <aside aria-label="Demo controls" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
    {!started ? <button type="button" onClick={() => { save({ started: true, stage }); onStart?.(); }}>Start guided demo</button> : <span aria-live="polite">Guided demo: {demoStageLabels[currentStage]}</span>}
    <button type="button" onClick={() => save({ started: true, stage: nextDemoStage(currentStage) })}>Skip to next stage</button>
    <button type="button" onClick={reset}>Reset demo</button>
  </aside>;
}
