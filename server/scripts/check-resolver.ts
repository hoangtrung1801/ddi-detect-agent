// M1 gate: the real resolver (real embeddings, no LLM) must map every golden input to the expected DB name.
// Inputs get the generic guess the LLM would give (the alias/vector path is exercised without it as well).
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.ts';
import { openDomain } from '../src/domain/open.ts';
import { loadEnvFiles } from '../src/env.ts';

loadEnvFiles();
const cfg = loadConfig();
const { resolver } = await openDomain(cfg);
const golden = JSON.parse(readFileSync(new URL('../test/fixtures/golden.json', import.meta.url), 'utf8'));
let ok = 0, total = 0;
for (const c of golden) {
  for (const [input, want] of Object.entries(c.expect.resolved) as [string, string | null][]) {
    total++;
    const r = await resolver.resolve(input);
    const got = r.dbName;
    const pass = got === want;
    if (pass) ok++;
    else console.log(`MISS ${c.id}: "${input}" want=${want} got=${got} (${r.method} ${r.confidence}) alts=${JSON.stringify(r.alternatives)}`);
  }
}
console.log(`resolver vs golden: ${ok}/${total}`);
process.exit(ok === total ? 0 : 1);
