import { mkdirSync, closeSync, openSync, readFileSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { crawlInteractionDetails, crawlStatus } from '../src/domain/ddinter-crawler.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const allowed = ['--status', '--max-pages=', '--page-ids=', '--concurrency=', '--interval-ms='];
if (args.some((a) => !allowed.some((prefix) => prefix.endsWith('=') ? a.startsWith(prefix) : a === prefix))) {
  throw new Error('Usage: pnpm data:crawl [--status] [--max-pages=N] [--page-ids=23,24] [--concurrency=N] [--interval-ms=N]');
}
const data = process.env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));
const database = process.env.DDI_DB_PATH ?? `${data}/ddi.sqlite`;
const archivePath = `${data}/ddinter/crawl.sqlite`;
if (args.includes('--status')) {
  if (!existsSync(archivePath)) console.log(JSON.stringify({ state: 'not_started' }));
  else {
    const archive = new Database(archivePath, { readonly: true });
    console.log(JSON.stringify(crawlStatus(archive), null, 2));
    archive.close();
  }
} else {
  const limit = args.find((a) => a.startsWith('--max-pages='))?.split('=')[1];
  const maxPages = limit === undefined ? undefined : Number(limit);
  if (maxPages !== undefined && (!Number.isSafeInteger(maxPages) || maxPages < 1)) throw new Error('--max-pages must be a positive integer');
  const numberFlag = (name: string, min: number) => {
    const raw = args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min) throw new Error(`--${name} must be an integer >= ${min}`);
    return value;
  };
  const concurrency = numberFlag('concurrency', 1);
  const intervalMs = numberFlag('interval-ms', 0);
  const ids = args.find((a) => a.startsWith('--page-ids='))?.split('=')[1];
  const pageIds = ids?.split(',').map(Number);
  if (pageIds?.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error('--page-ids must contain positive integer IDs');
  mkdirSync(dirname(archivePath), { recursive: true });
  const lockPath = `${archivePath}.lock`;
  if (existsSync(lockPath)) {
    const previousPid = Number(readFileSync(lockPath, 'utf8'));
    let alive = true;
    try { process.kill(previousPid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; }
    if (alive) throw new Error(`A crawler is already running (PID ${previousPid})`);
    unlinkSync(lockPath);
  }
  const lock = openSync(lockPath, 'wx');
  writeFileSync(lock, String(process.pid)); closeSync(lock);
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  let ready = false;
  try {
    const status = await crawlInteractionDetails({ database, archive: archivePath, maxPages, pageIds, concurrency, intervalMs, signal: abort.signal, onProgress: (progress) => {
      if (!ready && progress.state === 'running' && progress.completedPages > 0) { ready = true; console.log('DDINTER_CRAWL_READY'); }
      console.log(JSON.stringify({ at: new Date().toISOString(), ...progress }));
    } });
    console.log(JSON.stringify(status, null, 2));
    if (status.state === 'error') process.exitCode = 1;
  } finally {
    unlinkSync(lockPath);
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
  }
}
