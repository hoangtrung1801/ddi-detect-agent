import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';
import { call, makeAgentEnv } from '../helpers/agent-env.ts';

const draft = (pairs: any[], title = 'Kết quả') => ({ title, pairs, recommendations: ['Hỏi dược sĩ.'] });

describe('DDI agent (scripted model)', () => {
  it('happy path in 3 turns: statuses/conditions from the DB, risk from code, links attached', async () => {
    const env = await makeAgentEnv();
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Tylenol', generic_guess: 'acetaminophen' }, { input: 'Coumadin' }] }),
      call('check_interactions', { drugs: ['Acetaminophen', 'Warfarin'] }),
      call('submit_report', draft([{ a: 'Tylenol', b: 'Warfarin', severity: 'major', explanation: 'Tăng nguy cơ chảy máu.' }])),
    ]);
    const r = await env.agent.run({ text: 'Tôi uống Tylenol và Coumadin' }, { sink: env.sink });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.turns).toBe(3);
    expect(r.report.drugs.map((d) => d.dbName)).toEqual(['Acetaminophen', 'Warfarin']);
    expect(r.report.pairs).toHaveLength(1);
    expect(r.report.pairs[0]).toMatchObject({
      a: 'Acetaminophen',
      b: 'Warfarin',
      status: 'interaction',
      severity: 'major',
      db_condition: 'Acetaminophen may increase the anticoagulant activities of Warfarin, leading to bleeding.',
      explanation: 'Tăng nguy cơ chảy máu.',
    });
    expect(r.report.overall_risk).toBe('high');
    expect(Object.keys(r.report.links).sort()).toEqual(['Acetaminophen', 'Warfarin']);
    expect(r.report.disclaimer).toMatch(/không có nghĩa là an toàn/);
    const kinds = env.events.map((e) => e.type);
    expect(kinds).toContain('resolved');
    expect(kinds).toContain('pairs');
    expect(env.events.filter((e) => e.type === 'tool_end').length).toBe(3);
  });

  it('adds pairs the model skipped and drops pairs that do not exist', async () => {
    const env = await makeAgentEnv();
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Warfarin' }, { input: 'Ibuprofen' }, { input: 'Digoxin' }] }),
      call('check_interactions', { drugs: ['Warfarin', 'Ibuprofen', 'Digoxin'] }),
      call('submit_report', draft([
        { a: 'Warfarin', b: 'Ibuprofen', severity: 'moderate', explanation: 'Nguy cơ chảy máu.' },
        { a: 'Warfarin', b: 'Paracetamolzzz', explanation: 'Bịa.' },
      ])),
    ]);
    const r = await env.agent.run({ drugs: ['Warfarin', 'Ibuprofen', 'Digoxin'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.pairs).toHaveLength(3);
    const byKey = Object.fromEntries(r.report.pairs.map((p) => [`${p.a}|${p.b}`, p]));
    expect(byKey['Warfarin|Ibuprofen']!.status).toBe('interaction');
    expect(byKey['Warfarin|Digoxin']).toMatchObject({ status: 'no_record' });
    expect(byKey['Warfarin|Digoxin']!.explanation).toMatch(/Không có dữ liệu/);
    expect(byKey['Ibuprofen|Digoxin']!.explanation).toMatch(/không đồng nghĩa với an toàn/);
    expect(r.report.overall_risk).toBe('medium');
  });

  it('model claiming a no_record pair is safe cannot change the status or the wording', async () => {
    const env = await makeAgentEnv();
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Digoxin' }, { input: 'Cetirizine' }] }),
      call('check_interactions', { drugs: ['Digoxin', 'Cetirizine'] }),
      call('submit_report', draft([
        { a: 'Digoxin', b: 'Cetirizine', severity: 'minor', explanation: 'Hoàn toàn an toàn, không có tương tác.' },
      ])),
    ]);
    const r = await env.agent.run({ drugs: ['Digoxin', 'Cetirizine'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.report.pairs[0]!;
    expect(p.status).toBe('no_record');
    expect(p.severity).toBeUndefined();
    expect(p.explanation).not.toMatch(/Hoàn toàn an toàn/);
    expect(p.explanation).toMatch(/không đồng nghĩa với an toàn/);
    expect(r.report.overall_risk).toBe('unknown');
  });

  it('unresolved drug yields unresolved pairs and unknown risk', async () => {
    const env = await makeAgentEnv({ resolveMin: 0.95 });
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Warfarin' }, { input: 'Zzyzxtol' }] }),
      call('check_interactions', { drugs: ['Warfarin', 'Warfarin'] }),
      call('submit_report', draft([])),
    ]);
    const r = await env.agent.run({ drugs: ['Warfarin', 'Zzyzxtol'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.pairs).toEqual([
      expect.objectContaining({ a: 'Warfarin', b: 'Zzyzxtol', status: 'unresolved' }),
    ]);
    expect(r.report.overall_risk).toBe('unknown');
    expect(Object.keys(r.report.links)).toEqual(['Warfarin']);
  });

  it('submit_report before check_interactions is blocked and the model recovers', async () => {
    const env = await makeAgentEnv();
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Warfarin' }, { input: 'Ibuprofen' }] }),
      call('submit_report', draft([])),
      call('check_interactions', { drugs: ['Warfarin', 'Ibuprofen'] }),
      call('submit_report', draft([{ a: 'Warfarin', b: 'Ibuprofen', severity: 'major', explanation: 'x' }])),
    ]);
    const r = await env.agent.run({ drugs: ['Warfarin', 'Ibuprofen'] }, { sink: env.sink });
    expect(r.ok).toBe(true);
    expect(env.events.filter((e) => e.type === 'tool_end' && !e.ok)).toHaveLength(1);
  });

  it('invalid report schema is rejected, then a retry succeeds', async () => {
    const env = await makeAgentEnv();
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Warfarin' }, { input: 'Ibuprofen' }] }),
      call('check_interactions', { drugs: ['Warfarin', 'Ibuprofen'] }),
      call('submit_report', { pairs: [], recommendations: [] }), // missing title
      call('submit_report', draft([{ a: 'Warfarin', b: 'Ibuprofen', severity: 'bogus', explanation: 'x' }])), // bad severity
      call('submit_report', draft([{ a: 'Warfarin', b: 'Ibuprofen', severity: 'major', explanation: 'x' }])),
    ]);
    const r = await env.agent.run({ drugs: ['Warfarin', 'Ibuprofen'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.turns).toBe(5);
  });

  it('check_interactions with a non-database name errors back to the model', async () => {
    const env = await makeAgentEnv();
    env.setResponses([
      call('check_interactions', { drugs: ['Tylenol', 'Warfarin'] }),
      call('resolve_drugs', { drugs: [{ input: 'Tylenol' }, { input: 'Warfarin' }] }),
      call('check_interactions', { drugs: ['Acetaminophen', 'Warfarin'] }),
      call('submit_report', draft([])),
    ]);
    const r = await env.agent.run({ text: 'x' });
    expect(r.ok).toBe(true);
  });

  it('no submit_report: AGENT_NO_REPORT', async () => {
    const env = await makeAgentEnv();
    env.setResponses([fauxAssistantMessage('Hai thuốc này an toàn.')]);
    const r = await env.agent.run({ text: 'Warfarin và Ibuprofen' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('AGENT_NO_REPORT');
  });

  it('turn limit aborts a looping model', async () => {
    const env = await makeAgentEnv({ maxTurns: 2 });
    env.setResponses(Array.from({ length: 10 }, () => call('resolve_drugs', { drugs: [{ input: 'Warfarin' }] })));
    const r = await env.agent.run({ text: 'loop' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('AGENT_NO_REPORT');
    expect(r.error.message).toMatch(/more than 2 turns/);
    expect(env.calls()).toBeLessThanOrEqual(3);
  });

  it('timeout aborts a slow model', async () => {
    const env = await makeAgentEnv({ queryTimeoutMs: 1000 });
    env.setResponses([
      async () => {
        await new Promise((r) => setTimeout(r, 1500));
        return call('resolve_drugs', { drugs: [{ input: 'Warfarin' }] });
      },
    ]);
    const t0 = Date.now();
    const r = await env.agent.run({ text: 'slow' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('AGENT_TIMEOUT');
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('provider error maps to UPSTREAM_LLM', async () => {
    const env = await makeAgentEnv();
    env.setResponses([fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'boom 500' })]);
    const r = await env.agent.run({ text: 'x' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatchObject({ code: 'UPSTREAM_LLM' });
    expect(r.error.message).toMatch(/boom/);
  });

  it('every run gets its own context (no cross-request state)', async () => {
    const env = await makeAgentEnv();
    const run = (a: string, b: string) => {
      env.setResponses([
        call('resolve_drugs', { drugs: [{ input: a }, { input: b }] }),
        call('check_interactions', { drugs: [a, b] }),
        call('submit_report', draft([])),
      ]);
      return env.agent.run({ drugs: [a, b] });
    };
    const [r1] = await Promise.all([run('Warfarin', 'Ibuprofen')]);
    const r2 = await run('Digoxin', 'Omeprazole');
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r2.report.drugs.map((d) => d.dbName).sort()).toEqual(['Digoxin', 'Omeprazole']);
  });
});

describe('DDI agent: nothing resolvable', () => {
  it('all drugs unresolved still yields a report with unresolved pairs and unknown risk', async () => {
    const env = await makeAgentEnv({ resolveMin: 0.99 });
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Foobarazole' }, { input: 'Quuxinib' }] }),
      call('check_interactions', { drugs: [] }),
      call('submit_report', draft([])),
    ]);
    const r = await env.agent.run({ drugs: ['Foobarazole', 'Quuxinib'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.pairs.map((p) => p.status)).toEqual(['unresolved']);
    expect(r.report.overall_risk).toBe('unknown');
  });
});

describe('DDI agent: multi-ingredient products', () => {
  const supplement = { name: 'GH Creation EX+', ingredients: ['Acetaminophen', 'Cetirizine', 'Dried yeast'] };

  it('checks a product as ONE drug; ingredient interactions surface in the pair, not as extra drugs', async () => {
    const env = await makeAgentEnv();
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'GH Creation EX+' }, { input: 'Coumadin', generic_guess: 'warfarin' }] }),
      call('check_interactions', { drugs: ['GH Creation EX+', 'Warfarin'] }),
      call('submit_report', draft([{ a: 'GH Creation EX+', b: 'Warfarin', severity: 'major', explanation: 'Acetaminophen trong GH Creation EX+ làm tăng nguy cơ chảy máu với Warfarin.' }])),
    ]);
    const r = await env.agent.run({ drugs: [supplement, 'Coumadin'] }, { sink: env.sink });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // two drugs, one pair
    expect(r.report.drugs.map((d) => d.input)).toEqual(['GH Creation EX+', 'Coumadin']);
    expect(r.report.pairs).toHaveLength(1);
    const p = r.report.pairs[0]!;
    expect(p).toMatchObject({ a: 'GH Creation EX+', b: 'Warfarin', status: 'interaction', severity: 'major' });
    expect(p.ingredient_pairs).toEqual([
      { a: 'Acetaminophen', b: 'Warfarin', condition: 'Acetaminophen may increase the anticoagulant activities of Warfarin, leading to bleeding.' },
    ]);
    expect(p.explanation).toMatch(/Acetaminophen trong GH Creation/);
    const product = r.report.drugs[0]!;
    expect(product.dbName).toBe('GH Creation EX+');
    expect(product.ingredients?.map((i) => [i.input, i.dbName])).toEqual([
      ['Acetaminophen', 'Acetaminophen'],
      ['Cetirizine', 'Cetirizine'],
      ['Dried yeast', null],
    ]);
    expect(r.report.overall_risk).toBe('high');
    // links point at the interacting ingredients and the plain drug
    expect(Object.keys(r.report.links).sort()).toEqual(['Acetaminophen', 'Warfarin']);
    // the 'resolved' event is product-level too
    const resolved = env.events.find((e) => e.type === 'resolved');
    expect(resolved && resolved.type === 'resolved' && resolved.drugs.map((d) => d.input)).toEqual(['GH Creation EX+', 'Coumadin']);
  });

  it('works without the model resolving the product, and ignores the names it passes to check_interactions', async () => {
    const env = await makeAgentEnv();
    env.setResponses([
      call('check_interactions', { drugs: ['GH Creation EX+'] }),
      call('submit_report', draft([])),
    ]);
    const r = await env.agent.run({ drugs: [supplement, 'Warfarin'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.pairs).toHaveLength(1);
    expect(r.report.pairs[0]).toMatchObject({ status: 'interaction', explanation: expect.stringMatching(/Cơ sở dữ liệu ghi nhận/) });
  });

  it('no recorded ingredient pair: no_record, with how much could be checked', async () => {
    const env = await makeAgentEnv();
    env.setResponses([call('check_interactions', { drugs: [] }), call('submit_report', draft([]))]);
    const r = await env.agent.run({ drugs: [supplement, 'Digoxin'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.report.pairs[0]!;
    expect(p.status).toBe('no_record');
    expect(p.ingredient_pairs).toBeUndefined();
    expect(p.explanation).toMatch(/Đã tra cứu 2 cặp thành phần; chưa tra cứu được: Dried yeast/);
    expect(r.report.overall_risk).toBe('unknown');
  });

  it('product with no ingredient matching the database: unresolved pair', async () => {
    const env = await makeAgentEnv({ resolveMin: 0.99 });
    env.setResponses([call('check_interactions', { drugs: [] }), call('submit_report', draft([]))]);
    const r = await env.agent.run({ drugs: [{ name: 'Herbal X', ingredients: ['Foobar root', 'Quux leaf'] }, 'Warfarin'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.pairs[0]).toMatchObject({ status: 'unresolved' });
    expect(r.report.drugs[0]).toMatchObject({ input: 'Herbal X', dbName: null, method: 'none' });
  });

  it('ingredients of the same product are never compared with each other', async () => {
    const env = await makeAgentEnv();
    env.setResponses([call('check_interactions', { drugs: [] }), call('submit_report', draft([]))]);
    // Warfarin + Ibuprofen interact in the DB, but they are two ingredients of ONE product.
    const r = await env.agent.run({ drugs: [{ name: 'Combo', ingredients: ['Warfarin', 'Ibuprofen'] }, 'Digoxin'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.pairs).toHaveLength(1);
    expect(r.report.pairs[0]!.status).toBe('no_record');
  });

  it('resolves ingredients written the way labels write them to the underlying substance', async () => {
    const env = await makeAgentEnv();
    env.setResponses([call('check_interactions', { drugs: [] }), call('submit_report', draft([]))]);
    const label = { name: 'Blood Support', ingredients: ['Acetaminophen from corn starch', 'Digoxin (from Digitalis lanata)', 'Dried yeast'] };
    const r = await env.agent.run({ drugs: [label, 'Warfarin'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // input keeps the label text, dbName is the substance
    expect(r.report.drugs[0]!.ingredients?.map((i) => [i.input, i.dbName])).toEqual([
      ['Acetaminophen from corn starch', 'Acetaminophen'],
      ['Digoxin (from Digitalis lanata)', 'Digoxin'],
      ['Dried yeast', null],
    ]);
    expect(r.report.pairs[0]).toMatchObject({ status: 'interaction' });
    expect(r.report.pairs[0]!.ingredient_pairs).toEqual([expect.objectContaining({ a: 'Acetaminophen', b: 'Warfarin' })]);
  });
});
