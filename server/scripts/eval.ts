// Golden evaluation against the real LLM (costs money; not run in CI). Usage: pnpm eval [--ids a,b] [--limit n] [--concurrency n]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createDdiAgent } from '../src/agent/ddi-agent.ts';
import { loadConfig } from '../src/config.ts';
import { openDomain } from '../src/domain/open.ts';
import { link, memoryLinkCache } from '../src/domain/links.ts';
import { loadEnvFiles } from '../src/env.ts';
import { createOpenAiLlm } from '../src/llm/models.ts';
import { InteractionReportSchema } from '../src/schemas/report.ts';
import { Value } from 'typebox/value';
import { normName, pairKey } from '../src/util/norm.ts';

loadEnvFiles();
const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const cfg = loadConfig();
if (!cfg.openaiApiKey) throw new Error('OPENAI_API_KEY is required for pnpm eval');
const golden: any[] = JSON.parse(readFileSync(new URL('../test/fixtures/golden.json', import.meta.url), 'utf8'));
const ids = opt('ids')?.split(',');
let cases = ids ? golden.filter((c) => ids.includes(c.id)) : golden;
if (opt('limit')) cases = cases.slice(0, Number(opt('limit')));
const concurrency = Number(opt('concurrency') ?? 3);

const { drugDb, resolver } = await openDomain(cfg);
const llm = createOpenAiLlm();
const cache = memoryLinkCache();
const agent = createDdiAgent({
  drugDb, resolver, llm,
  linkFn: (n) => link(n, { cache }),
  config: { agentModel: cfg.agentModel, reasoningEffort: cfg.reasoningEffort, maxTurns: cfg.maxTurns, queryTimeoutMs: cfg.queryTimeoutMs },
});

interface CaseResult {
  id: string; ok: boolean; notes: string[]; pairsExpected: number; pairsMatched: number;
  latencyMs: number; turns: number; tokens: number; costUsd: number; unsafe: number; schemaValid: boolean; error?: string;
}

async function runCase(c: any): Promise<CaseResult> {
  const r = await agent.run(c.input);
  const base = { id: c.id, latencyMs: r.stats.latencyMs, turns: r.stats.turns, tokens: r.stats.totalTokens, costUsd: r.stats.costUsd };
  const expPairs: { a: string; b: string; status: string }[] = c.expect.pairs;
  const expTotal = expPairs.length + c.expect.unresolved_pairs;
  if (!r.ok) return { ...base, ok: false, notes: [`${r.error.code}: ${r.error.message}`], pairsExpected: expTotal, pairsMatched: 0, unsafe: 0, schemaValid: false, error: r.error.code };
  const rep = r.report;
  const notes: string[] = [];
  const schemaValid = Value.Check(InteractionReportSchema, rep);
  const gotNames = new Set(rep.drugs.filter((d) => d.dbName).map((d) => normName(d.dbName!)));
  const wantNames = new Set(Object.values(c.expect.resolved).filter(Boolean).map((n: any) => normName(n)));
  const wantUnres: number = Object.values(c.expect.resolved).filter((v) => v === null).length;
  const gotUnres = rep.drugs.filter((d) => !d.dbName).length;
  if ([...wantNames].some((n) => !gotNames.has(n)) || [...gotNames].some((n) => !wantNames.has(n))) notes.push(`resolved mismatch: got ${[...gotNames].join(',')} want ${[...wantNames].join(',')}`);
  if (gotUnres !== wantUnres) notes.push(`unresolved drugs: got ${gotUnres} want ${wantUnres}`);
  let matched = 0;
  const byKey = new Map(rep.pairs.map((p) => [pairKey(normName(p.a), normName(p.b)), p]));
  for (const e of expPairs) {
    const p = byKey.get(pairKey(normName(e.a), normName(e.b)));
    if (p?.status === e.status) matched++;
    else notes.push(`pair ${e.a}+${e.b}: want ${e.status} got ${p?.status ?? 'missing'}`);
  }
  const gotUnresPairs = rep.pairs.filter((p) => p.status === 'unresolved').length;
  if (gotUnresPairs === c.expect.unresolved_pairs) matched += c.expect.unresolved_pairs;
  else notes.push(`unresolved pairs: got ${gotUnresPairs} want ${c.expect.unresolved_pairs}`);
  const unsafe = rep.pairs.filter((p) => p.status !== 'interaction' && !/^(Không có dữ liệu|Không xác định)/.test(p.explanation)).length;
  if (unsafe) notes.push(`${unsafe} non-interaction pair(s) without the unknown wording`);
  if (rep.pairs.length !== expTotal) notes.push(`pair count ${rep.pairs.length} want ${expTotal}`);
  const ok = notes.length === 0 && schemaValid;
  return { ...base, ok, notes, pairsExpected: expTotal, pairsMatched: matched, unsafe, schemaValid };
}

const results: CaseResult[] = [];
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < cases.length) {
    const c = cases[next++];
    try { results.push(await runCase(c)); } catch (e: any) {
      results.push({ id: c.id, ok: false, notes: [`exception ${e?.message}`], pairsExpected: 0, pairsMatched: 0, latencyMs: 0, turns: 0, tokens: 0, costUsd: 0, unsafe: 0, schemaValid: false, error: 'EXCEPTION' });
    }
    const last = results[results.length - 1]!;
    console.log(`${last.ok ? 'PASS' : 'FAIL'} ${last.id} ${last.latencyMs}ms turns=${last.turns} tok=${last.tokens}${last.notes.length ? '\n   ' + last.notes.join('\n   ') : ''}`);
  }
}));

const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0; };
const pe = results.reduce((a, r) => a + r.pairsExpected, 0);
const pm = results.reduce((a, r) => a + r.pairsMatched, 0);
const summary = {
  model: cfg.agentModel, reasoning: cfg.reasoningEffort, cases: results.length,
  casesPassed: results.filter((r) => r.ok).length,
  pairStatusAgreement: pe ? pm / pe : 0, pairsMatched: pm, pairsExpected: pe,
  unsafePairs: results.reduce((a, r) => a + r.unsafe, 0),
  schemaValid: results.filter((r) => r.schemaValid).length,
  medianLatencyMs: med(results.map((r) => r.latencyMs)), p90LatencyMs: [...results.map((r) => r.latencyMs)].sort((a, b) => a - b)[Math.floor(results.length * 0.9)] ?? 0,
  medianTurns: med(results.map((r) => r.turns)), medianTokens: med(results.map((r) => r.tokens)),
  totalTokens: results.reduce((a, r) => a + r.tokens, 0), totalCostUsd: results.reduce((a, r) => a + r.costUsd, 0),
  failures: results.filter((r) => !r.ok).map((r) => r.id),
};
mkdirSync(new URL('../eval-results/', import.meta.url), { recursive: true });
writeFileSync(new URL(`../eval-results/${Date.now()}.json`, import.meta.url), JSON.stringify({ summary, results }, null, 1));
console.log('\nSUMMARY', JSON.stringify(summary, null, 2));
process.exit(summary.failures.length ? 1 : 0);
