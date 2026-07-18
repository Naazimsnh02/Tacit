export type HistoricalCaseImport = {
  readonly label: string;
  readonly input: Record<string, unknown>;
  readonly expectedOutcome: Record<string, unknown>;
  readonly evidenceFiles: readonly string[];
};

function parseRows(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]; const next = source[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ''; continue;
    }
    cell += character;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  if (quoted) throw new Error('The CSV has an unterminated quoted value.');
  return rows;
}

/** Parses the small, portable CSV contract used by every workflow-pack replay importer. */
export function parseHistoricalCaseCsv(source: string): HistoricalCaseImport[] {
  const [header, ...rows] = parseRows(source);
  if (!header) throw new Error('The CSV is empty.');
  const indices = new Map(header.map((value, index) => [value.trim().toLowerCase(), index]));
  const required = ['label', 'input_json', 'expected_outcome_json', 'evidence_files'];
  if (required.some((field) => !indices.has(field))) throw new Error('CSV columns must be label, input_json, expected_outcome_json, and evidence_files.');
  return rows.map((row, index) => {
    const value = (field: string) => row[indices.get(field) ?? -1]?.trim() ?? '';
    try {
      return {
        label: value('label'), input: JSON.parse(value('input_json')) as Record<string, unknown>,
        expectedOutcome: JSON.parse(value('expected_outcome_json')) as Record<string, unknown>,
        evidenceFiles: value('evidence_files').split(';').map((item) => item.trim()).filter(Boolean),
      };
    } catch {
      throw new Error(`Row ${index + 2} contains invalid JSON.`);
    }
  });
}
