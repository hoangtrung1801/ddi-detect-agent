/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Returns rows of string fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface InteractionRow {
  drug_1: string;
  drug_2: string;
  condition: string;
  drug_1_id?: string;
  drug_2_id?: string;
  level?: string;
  source_rows?: string;
}

export function parseInteractionCsv(text: string): InteractionRow[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const i1 = header.indexOf('drug_1');
  const i2 = header.indexOf('drug_2');
  const ic = header.indexOf('condition');
  if (i1 < 0 || i2 < 0 || ic < 0) throw new Error('CSV must have columns drug_1,drug_2,condition');
  const extra = ['drug_1_id', 'drug_2_id', 'level', 'source_rows'] as const;
  return rows.map((r, index) => {
    if (r.length !== header.length || [i1, i2, ic].some((i) => !r[i]?.trim())) {
      throw new Error(`Invalid interaction CSV row ${index + 2}`);
    }
    const out: InteractionRow = { drug_1: r[i1]!, drug_2: r[i2]!, condition: r[ic]! };
    for (const key of extra) {
      const i = header.indexOf(key);
      if (i >= 0 && r[i]) out[key] = r[i]!;
    }
    return out;
  });
}
