// Crawl DDInter drug interaction listings (pairs missing from the category CSV exports),
// then optionally apply them to the current database and extend the name/vector files.
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { applyListingSupplement, crawlInteractionListings, listingCrawlStatus, readListingEntries } from '../src/domain/ddinter-listings.ts';
import { createTransformersEmbedder, EMBED_DIM } from '../src/domain/embedder.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const allowed = ['--status', '--apply', '--max-requests=', '--concurrency=', '--interval-ms='];
if (args.some((a) => !allowed.some((prefix) => prefix.endsWith('=') ? a.startsWith(prefix) : a === prefix))) {
  throw new Error('Usage: pnpm data:listings [--status | --apply] [--max-requests=N] [--concurrency=N] [--interval-ms=N]');
}
const data = process.env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));
const database = process.env.DDI_DB_PATH ?? `${data}/ddi.sqlite`;
const archivePath = `${data}/ddinter/listings.sqlite`;
const numberFlag = (name: string, min: number) => {
  const raw = args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`--${name} must be an integer >= ${min}`);
  return value;
};

if (args.includes('--status')) {
  if (!existsSync(archivePath)) console.log(JSON.stringify({ state: 'not_started' }));
  else {
    const archive = new Database(archivePath, { readonly: true });
    console.log(JSON.stringify(listingCrawlStatus(archive), null, 2));
    archive.close();
  }
} else if (args.includes('--apply')) {
  await apply();
} else {
  mkdirSync(dirname(archivePath), { recursive: true });
  const lockPath = `${archivePath}.lock`;
  if (existsSync(lockPath)) {
    const previousPid = Number(readFileSync(lockPath, 'utf8'));
    let alive = true;
    try { process.kill(previousPid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; }
    if (alive) throw new Error(`A listing crawler is already running (PID ${previousPid})`);
    unlinkSync(lockPath);
  }
  const lock = openSync(lockPath, 'wx');
  writeFileSync(lock, String(process.pid)); closeSync(lock);
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  try {
    const status = await crawlInteractionListings({
      database, archive: archivePath, signal: abort.signal,
      maxRequests: numberFlag('max-requests', 1), concurrency: numberFlag('concurrency', 1), intervalMs: numberFlag('interval-ms', 0),
      onProgress: (progress) => console.log(JSON.stringify({ at: new Date().toISOString(), ...progress })),
    });
    console.log(JSON.stringify(status, null, 2));
    if (status.state === 'error') process.exitCode = 1;
  } finally {
    unlinkSync(lockPath);
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
  }
}

/** Apply a completed listing crawl to the current database in a staging copy, then swap files. */
async function apply() {
  if (!existsSync(archivePath)) throw new Error('No listing archive; run pnpm data:listings first');
  if (existsSync(`${archivePath}.lock`)) throw new Error('Stop the listing crawler before applying');
  const archive = new Database(archivePath, { readonly: true });
  const status = listingCrawlStatus(archive);
  const { entries, complete } = readListingEntries(archive);
  archive.close();
  if (!complete || status.state !== 'completed') throw new Error(`Listing crawl is ${status.state}; finish it before applying`);
  const namesPath = `${data}/drug-names.json`, vectorsPath = `${data}/drug-vectors.f32`;
  const staging = mkdtempSync(`${data}/.ddinter-listings-`);
  let db: Database.Database | undefined;
  try {
    copyFileSync(database, `${staging}/ddi.sqlite`);
    db = new Database(`${staging}/ddi.sqlite`);
    db.pragma('foreign_keys = ON');
    if (db.prepare('SELECT 1 FROM dataset_metadata WHERE key=?').get('supplement')) throw new Error('Listing supplement already applied; rebuild with pnpm data:build to re-apply');
    const names = JSON.parse(readFileSync(namesPath, 'utf8')) as string[];
    const catalog = db.prepare('SELECT name FROM drugs ORDER BY id').all() as { name: string }[];
    if (catalog.length !== names.length || catalog.some((d, i) => d.name !== names[i])) throw new Error('drug-names.json does not match the database');
    const stats = applyListingSupplement(db, entries);
    const supplement = { archive: 'ddinter/listings.sqlite', crawledDrugs: status.queuedDrugs, listingEntries: status.entries, appliedAt: new Date().toISOString(), ...stats };
    db.prepare('INSERT INTO dataset_metadata(key,value) VALUES (?,?)').run('supplement', JSON.stringify(supplement));
    const manifestPath = `${data}/ddinter/manifest.json`;
    if (existsSync(manifestPath)) db.prepare('INSERT OR REPLACE INTO dataset_metadata(key,value) VALUES (?,?)').run('manifest', readFileSync(manifestPath, 'utf8'));
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || (db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Database integrity failed');
    const added = (db.prepare('SELECT name FROM drugs WHERE id>? ORDER BY id').all(names.length) as { name: string }[]).map((d) => d.name);
    db.close(); db = undefined;
    const vectors = readFileSync(vectorsPath);
    if (vectors.byteLength !== names.length * EMBED_DIM * 4) throw new Error('drug-vectors.f32 does not match drug-names.json');
    let extra = Buffer.alloc(0);
    if (added.length) {
      const embedder = await createTransformersEmbedder();
      const out = await embedder.embed(added);
      if (out.length !== added.length || out.some((v) => v.length !== EMBED_DIM || !v.every(Number.isFinite))) throw new Error('Invalid embedding');
      const flat = new Float32Array(added.length * EMBED_DIM);
      out.forEach((v, i) => flat.set(v, i * EMBED_DIM));
      extra = Buffer.from(flat.buffer);
    }
    writeFileSync(`${staging}/drug-vectors.f32`, Buffer.concat([vectors, extra]));
    writeFileSync(`${staging}/drug-names.json`, JSON.stringify([...names, ...added]));
    for (const file of ['drug-vectors.f32', 'drug-names.json', 'ddi.sqlite']) renameSync(`${staging}/${file}`, `${data}/${file}`);
    console.log(JSON.stringify(supplement, null, 2));
  } finally {
    db?.close();
    rmSync(staging, { recursive: true, force: true });
  }
}
