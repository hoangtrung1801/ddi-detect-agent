// Fill the label cache (app DB, 30 days) with FDA labels of the most-connected drugs, so live checks do not wait on
// openFDA, which can take 10+ s per query. Usage: node scripts/prefetch-labels.ts [count, default 150]
// Without OPENFDA_API_KEY openFDA allows ~1,000 requests a day (up to 3 per drug), so keep the count modest.
import Database from 'better-sqlite3';
import { loadConfig } from '../src/config.ts';
import { DrugDb } from '../src/domain/drug-db.ts';
import { fetchLabel } from '../src/domain/drug-labels.ts';
import { loadEnvFiles } from '../src/env.ts';
import { openAppDb } from '../src/store/app-db.ts';
import { SqlCache } from '../src/store/cache.ts';

loadEnvFiles();
const cfg = loadConfig();
const count = Number(process.argv[2] ?? 150);
const drugDb = new DrugDb(new Database(cfg.ddiDbPath, { readonly: true, fileMustExist: true }));
const cache = new SqlCache(openAppDb(cfg.appDbPath)).labelCache();
let found = 0;
let missing = 0;
for (const [i, d] of drugDb.hubs(count).entries()) {
  const label = await fetchLabel(d.name, { cache, ...(cfg.openFdaApiKey ? { apiKey: cfg.openFdaApiKey } : {}) });
  if (label) found++;
  else missing++;
  console.log(`${i + 1}/${count} ${d.name}: ${label ? label.url : 'no label (or openFDA unavailable)'}`);
}
console.log(`done: ${found} labels cached, ${missing} without a label`);
drugDb.close();
