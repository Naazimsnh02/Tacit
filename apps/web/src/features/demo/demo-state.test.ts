import { describe, expect, it } from 'vitest';
import { nextDemoStage, parseDemoProgress } from './demo-state';

describe('demo progress', () => {
  it('falls back safely for missing or malformed browser state', () => {
    expect(parseDemoProgress(null)).toEqual({ started: false, stage: 'overview' });
    expect(parseDemoProgress('{not json')).toEqual({ started: false, stage: 'overview' });
    expect(parseDemoProgress(JSON.stringify({ started: true, stage: 'unknown' }))).toEqual({ started: false, stage: 'overview' });
  });

  it('advances through the prescribed demonstration stages', () => {
    expect(nextDemoStage('observe')).toBe('discover');
    expect(nextDemoStage('impact')).toBe('impact');
  });
});
