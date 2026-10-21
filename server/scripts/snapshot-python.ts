// Records the legacy Python API's /query and cabinet outputs for the golden inputs.
// Needs the Python server running (with its paid LLM calls): `python -m app.main`, then
//   PY_BASE_URL=http://localhost:8000 pnpm snapshot:python
// Output: test/fixtures/python-snapshot.json
import { readFileSync, writeFileSync } from 'node:fs';

const base = process.env.PY_BASE_URL ?? 'http://localhost:8000';
const golden: any[] = JSON.parse(readFileSync(new URL('../test/fixtures/golden.json', import.meta.url), 'utf8'));
const out: Record<string, unknown> = {};

for (const c of golden) {
  const question = c.input.text ?? `What are the interactions between ${c.input.drugs.join(' and ')}?`;
  const res = await fetch(`${base}/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
  out[c.id] = { question, status: res.status, body: await res.json().catch(() => null) };
  console.log(c.id, res.status);
}

const cabinet: unknown[] = [];
await fetch(`${base}/medicine-cabinet/clear?user_id=snapshot`, { method: 'DELETE' });
for (const name of ['Tylenol', 'Coumadin', 'Advil']) {
  const r = await fetch(`${base}/medicine-cabinet/add`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drug_name: name, user_id: 'snapshot' }) });
  cabinet.push({ add: name, status: r.status, body: await r.json() });
}
await new Promise((r) => setTimeout(r, 60_000)); // Python checks interactions in a background task
cabinet.push({ list: await (await fetch(`${base}/medicine-cabinet/list?user_id=snapshot`)).json() });
out['__cabinet'] = cabinet;
writeFileSync(new URL('../test/fixtures/python-snapshot.json', import.meta.url), JSON.stringify(out, null, 1));
