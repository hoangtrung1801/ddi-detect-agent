import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DDINTER, interactionCsv, preprocessDdinter } from '../src/domain/ddinter.ts';

const dir = process.env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));
const rawDir = `${dir}/ddinter/raw`;
mkdirSync(rawDir, { recursive: true });
const files = await Promise.all(DDINTER.categories.map(async (code) => {
  const name = `ddinter_downloads_code_${code}.csv`;
  const url = `https://ddinter2.scbdd.com/static/media/download/${name}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { name, url, bytes, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), sha256: createHash('sha256').update(bytes).digest('hex'), retrievedAt: new Date().toISOString() };
}));
const result = preprocessDdinter(files);
if (!result.rows.length) throw new Error('DDInter exports contained no interactions');
const csv = interactionCsv(result.rows);
const csvPath = fileURLToPath(new URL('../../db_drug_interactions.csv', import.meta.url));
const manifest = {
  source: DDINTER.source, homepage: DDINTER.homepage, downloadPage: DDINTER.downloads,
  terms: DDINTER.terms, license: DDINTER.license, websiteUpdated: DDINTER.websiteUpdated,
  attribution: 'DDInter 2.0, curated by the DDInter team. https://ddinter2.scbdd.com/',
  limitations: 'Official category exports only; not the entire advertised database. Mechanisms, management guidance and references are not supplied in these CSV exports. Unknown is not a minor interaction. No record does not imply safety.',
  sourceRows: result.sourceRows, duplicateRows: result.duplicateRows, records: result.rows.length,
  drugs: new Set(result.rows.flatMap((r) => [r.drug_1_id, r.drug_2_id])).size,
  levels: Object.fromEntries(['Major', 'Moderate', 'Minor', 'Unknown'].map((level) => [level, result.rows.filter((r) => r.level === level).length])),
  files: files.map(({ name, url, bytes, sha256, retrievedAt }) => ({ name, url, bytes: bytes.length, sha256, retrievedAt })),
  processed: { file: 'db_drug_interactions.csv', sha256: createHash('sha256').update(csv).digest('hex') },
};
for (const f of files) {
  writeFileSync(`${rawDir}/${f.name}.tmp`, f.bytes);
  renameSync(`${rawDir}/${f.name}.tmp`, `${rawDir}/${f.name}`);
}
writeFileSync(`${csvPath}.tmp`, csv);
writeFileSync(`${dir}/ddinter/manifest.json.tmp`, JSON.stringify(manifest, null, 2) + '\n');
renameSync(`${csvPath}.tmp`, csvPath);
renameSync(`${dir}/ddinter/manifest.json.tmp`, `${dir}/ddinter/manifest.json`);
console.log(JSON.stringify(manifest, null, 2));
