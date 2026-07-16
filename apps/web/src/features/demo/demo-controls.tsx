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
    window.location.assign('/demo');
  }

  return <aside aria-label="Demo controls" className="header-actions">
    {!started ? <button className="btn btn-primary" type="button" onClick={() => { save({ started: true, stage }); onStart?.(); }}>Start guided demo</button> : <span className="status status-info" aria-live="polite">Guided demo: {demoStageLabels[currentStage]}</span>}
    <button className="btn btn-secondary" type="button" onClick={() => save({ started: true, stage: nextDemoStage(currentStage) })}>Skip to next stage</button>
    <button className="btn btn-ghost" type="button" onClick={reset}>Reset demo</button>
  </aside>;
}
