// Build the DDInter database and matching embeddings before replacing active artifacts.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { buildDdiDb } from '../src/domain/build-db.ts';
import { createTransformersEmbedder } from '../src/domain/embedder.ts';
import { parseInteractionCsv } from '../src/util/csv.ts';
import { applyInteractionDetail } from '../src/domain/ddinter-details.ts';
import { applyListingSupplement, listingCrawlStatus, readListingEntries } from '../src/domain/ddinter-listings.ts';

const csvPath = fileURLToPath(new URL('../../db_drug_interactions.csv', import.meta.url));
const outDir = process.env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));
const manifestPath = `${outDir}/ddinter/manifest.json`;
const archivePath = `${outDir}/ddinter/crawl.sqlite`;
const listingsPath = `${outDir}/ddinter/listings.sqlite`;
if (existsSync(`${archivePath}.lock`) || existsSync(`${listingsPath}.lock`)) throw new Error('Stop the DDInter crawlers before rebuilding the database; resume them afterward.');
if (!existsSync(manifestPath)) throw new Error('Missing DDInter source manifest. Run pnpm data:download first.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const csv = readFileSync(csvPath, 'utf8');
if (createHash('sha256').update(csv).digest('hex') !== manifest.processed.sha256) throw new Error('Processed CSV checksum differs from DDInter manifest');
const rows = parseInteractionCsv(csv);
if (rows.length !== manifest.records || rows.some((r) => !r.drug_1_id || !r.drug_2_id || !r.level || !r.source_rows)) {
  throw new Error('Expected processed DDInter records with IDs, levels and provenance');
}
mkdirSync(outDir, { recursive: true });
const staging = mkdtempSync(`${outDir}/.ddinter-build-`);
let db: Database.Database | undefined;
try {
  db = new Database(`${staging}/ddi.sqlite`);
  db.pragma('foreign_keys = ON');
  const stats = buildDdiDb(db, rows);
  if (stats.drugs !== manifest.drugs) throw new Error('Drug count differs from source manifest');
  db.prepare('INSERT INTO dataset_metadata(key,value) VALUES (?,?)').run('manifest', JSON.stringify(manifest));
  // Pairs the website lists but the category CSV exports omit; applied before page details so those can attach.
  if (existsSync(listingsPath)) {
    const listings = new Database(listingsPath, { readonly: true });
    try {
      const status = listingCrawlStatus(listings);
      const { entries, complete } = readListingEntries(listings);
      if (!complete || status.state !== 'completed') throw new Error(`Listing crawl is ${status.state}; finish it (pnpm data:listings) or move ${listingsPath} aside`);
      const supplement = applyListingSupplement(db, entries);
      db.prepare('INSERT INTO dataset_metadata(key,value) VALUES (?,?)').run('supplement', JSON.stringify({ archive: 'ddinter/listings.sqlite', crawledDrugs: status.queuedDrugs, listingEntries: status.entries, appliedAt: new Date().toISOString(), ...supplement }));
      if (manifest.supplement && (manifest.supplement.addedPairs !== supplement.addedPairs || manifest.supplement.addedDrugs !== supplement.addedDrugs)) throw new Error('Listing supplement differs from source manifest');
      stats.names.push(...supplement.addedDrugNames);
      stats.drugs += supplement.addedDrugs;
      stats.interactions += supplement.addedPairs;
      console.log(`Added ${supplement.addedPairs} website-listed pairs and ${supplement.addedDrugs} drugs.`);
    } finally { listings.close(); }
  }
  if (existsSync(archivePath)) {
    const archive = new Database(archivePath, { readonly: true });
    let applied = 0;
    try {
      db.transaction(() => {
        for (const row of archive.prepare("SELECT detail_json FROM pages WHERE state='done' ORDER BY id").iterate() as Iterable<{ detail_json: string }>) {
          if (applyInteractionDetail(db!, JSON.parse(row.detail_json))) applied++;
        }
      })();
      db.prepare('INSERT INTO dataset_metadata(key,value) VALUES (?,?)').run('enrichment', JSON.stringify({ archive: 'ddinter/crawl.sqlite', applied }));
      console.log(`Restored ${applied} crawled source pages from the enrichment archive.`);
    } finally { archive.close(); }
  }
  if (db.pragma('integrity_check', { simple: true }) !== 'ok' || (db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Database integrity failed');
  db.close(); db = undefined;
  console.log(`DDInter rows=${stats.rows} drugs=${stats.drugs} pairs=${stats.interactions}`);
  const embedder = await createTransformersEmbedder();
  const flat = new Float32Array(stats.names.length * embedder.dim);
  // Bound embedding memory on large catalogs.
  for (let start = 0; start < stats.names.length; start += 64) {
    const vectors = await embedder.embed(stats.names.slice(start, start + 64));
    if (vectors.length !== Math.min(64, stats.names.length - start)) throw new Error('Embedding count mismatch');
    vectors.forEach((v, i) => {
      if (v.length !== embedder.dim || !v.every(Number.isFinite)) throw new Error('Invalid embedding');
      flat.set(v, (start + i) * embedder.dim);
    });
  }
  writeFileSync(`${staging}/drug-vectors.f32`, Buffer.from(flat.buffer));
  writeFileSync(`${staging}/drug-names.json`, JSON.stringify(stats.names));
  // Offline rebuild: stop the server first so no process retains an old database/catalog.
  for (const file of ['drug-vectors.f32', 'drug-names.json', 'ddi.sqlite']) renameSync(`${staging}/${file}`, `${outDir}/${file}`);
  console.log(`Replaced DDInter database and ${stats.drugs} x ${embedder.dim} vectors.`);
} finally {
  db?.close();
  rmSync(staging, { recursive: true, force: true });
}
