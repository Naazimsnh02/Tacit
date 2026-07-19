import { describe, expect, it } from 'vitest';
import { previewText, suggestedEvidenceType } from './evidence-intake-utils';

describe('evidence intake helpers', () => {
  it('suggests evidence types independently for a mixed upload selection', () => {
    expect(suggestedEvidenceType({ name: 'AP review SOP.pdf', type: 'application/pdf' })).toBe('sop');
    expect(suggestedEvidenceType({ name: 'review-recording.mp4', type: 'video/mp4' })).toBe('video');
    expect(suggestedEvidenceType({ name: 'invoice-export.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).toBe('spreadsheet');
  });

  it('creates a compact, normalized preview for extracted content', () => {
    expect(previewText('  First line\n\nsecond line  ')).toBe('First line second line');
    expect(previewText('a'.repeat(20), 12)).toBe('aaaaaaaaaaaa…');
  });
});
