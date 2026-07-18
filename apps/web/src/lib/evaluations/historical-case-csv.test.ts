import { describe, expect, it } from 'vitest';
import { parseHistoricalCaseCsv } from './historical-case-csv';

describe('historical-case CSV parser', () => {
  it('parses quoted JSON and multiple evidence filenames', () => {
    const cases = parseHistoricalCaseCsv('label,input_json,expected_outcome_json,evidence_files\n"Hold case","{""invoiceReference"":""INV-1""}","{""decision"":""hold""}","invoice.md;sop.md"\n');

    expect(cases).toEqual([{
      label: 'Hold case', input: { invoiceReference: 'INV-1' }, expectedOutcome: { decision: 'hold' }, evidenceFiles: ['invoice.md', 'sop.md'],
    }]);
  });

  it('rejects a CSV without the portable import columns', () => {
    expect(() => parseHistoricalCaseCsv('label,input\nCase,{}\n')).toThrow('CSV columns must be');
  });
});
