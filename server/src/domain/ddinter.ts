import { parseCsv, type InteractionRow } from '../util/csv.ts';
import { normName } from '../util/norm.ts';
import type { InteractionDetail } from './ddinter-details.ts';

export const DDINTER = {
  source: 'DDInter 2.0',
  homepage: 'https://ddinter2.scbdd.com/',
  downloads: 'https://ddinter2.scbdd.com/download/',
  terms: 'https://ddinter2.scbdd.com/terms/',
  license: 'CC-BY-NC-SA-4.0',
  websiteUpdated: '2024-05-14',
  categories: ['A', 'B', 'D', 'H', 'L', 'P', 'R', 'V'],
} as const;

export interface SourceInteractionRecord {
  source: 'DDInter 2.0';
  drugAId: string;
  drugBId: string;
  level: string;
  url: string;
  details?: InteractionDetail[];
}

export function preprocessDdinter(files: { name: string; text: string }[]): {
  rows: InteractionRow[]; sourceRows: number; duplicateRows: number;
} {
  const records = new Map<string, InteractionRow>();
  const names = new Map<string, string>();
  const normalized = new Map<string, string>();
  let sourceRows = 0;
  for (const file of files) {
    const [header, ...data] = parseCsv(file.text.replace(/^\uFEFF/, ''));
    const fields = ['DDInterID_A', 'Drug_A', 'DDInterID_B', 'Drug_B', 'Level'];
    if (!header || fields.some((f, i) => header[i] !== f) || header.length !== fields.length) {
      throw new Error(`${file.name}: unexpected DDInter columns`);
    }
    for (const [index, values] of data.entries()) {
      const line = index + 2;
      if (values.length !== 5 || values.some((v) => !v.trim())) throw new Error(`${file.name}:${line}: incomplete record`);
      const [idA, nameA, idB, nameB, level] = values.map((v) => v.trim()) as [string, string, string, string, string];
      if (![idA, idB].every((id) => /^DDInter\d+$/.test(id)) || idA === idB) throw new Error(`${file.name}:${line}: invalid drug IDs`);
      if (!['Major', 'Moderate', 'Minor', 'Unknown'].includes(level)) throw new Error(`${file.name}:${line}: unexpected risk level ${level}`);
      for (const [id, name] of [[idA, nameA], [idB, nameB]]) {
        if (names.has(id!) && names.get(id!) !== name) throw new Error(`Conflicting names for ${id}`);
        const key = normName(name!);
        if (normalized.has(key) && normalized.get(key) !== id) throw new Error(`Distinct DDInter IDs share normalized name ${name}`);
        names.set(id!, name!);
        normalized.set(key, id!);
      }
      sourceRows++;
      // CSV endpoint order is not a pharmacological direction. Canonicalize IDs only for deduplication.
      const ordered = Number(idA.slice(7)) < Number(idB.slice(7));
      const [a, b, na, nb] = ordered ? [idA, idB, nameA, nameB] : [idB, idA, nameB, nameA];
      const key = `${a}|${b}|${level}`;
      const origin = `${file.name}:${line}`;
      const existing = records.get(key);
      if (existing) existing.source_rows = `${existing.source_rows};${origin}`;
      else records.set(key, {
        drug_1: na, drug_2: nb, drug_1_id: a, drug_2_id: b, level, source_rows: origin,
        condition: `DDInter 2.0 risk level: ${level}. The downloadable source does not provide a mechanism description or management guidance.`,
      });
    }
  }
  const rows = [...records.values()].sort((a, b) => Number(a.drug_1_id!.slice(7)) - Number(b.drug_1_id!.slice(7)) || Number(a.drug_2_id!.slice(7)) - Number(b.drug_2_id!.slice(7)) || a.level!.localeCompare(b.level!));
  return { rows, sourceRows, duplicateRows: sourceRows - rows.length };
}

export function interactionCsv(rows: InteractionRow[]): string {
  const header = ['drug_1', 'drug_2', 'condition', 'drug_1_id', 'drug_2_id', 'level', 'source_rows'] as const;
  const quote = (s: string) => /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  return [header.join(','), ...rows.map((r) => header.map((k) => quote(r[k] ?? '')).join(','))].join('\n') + '\n';
}
