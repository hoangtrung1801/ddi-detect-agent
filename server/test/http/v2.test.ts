import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { InteractionReportSchema } from '../../src/schemas/report.ts';
import { call } from '../helpers/agent-env.ts';
import { makeHttpEnv } from '../helpers/http-env.ts';

const draft = (pairs: any[] = []) => ({ title: 'Kết quả', pairs, recommendations: ['Hỏi dược sĩ.'] });
const happy = (env: Awaited<ReturnType<typeof makeHttpEnv>>) =>
  env.setResponses([
    call('resolve_drugs', { drugs: [{ input: 'Warfarin' }, { input: 'Ibuprofen' }] }),
    call('check_interactions', { drugs: ['Warfarin', 'Ibuprofen'] }),
    call('submit_report', draft([{ a: 'Warfarin', b: 'Ibuprofen', severity: 'major', explanation: 'x' }])),
  ]);

function parseSse(text: string): { event: string; data: any }[] {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const ev = /^event: (.*)$/m.exec(block)?.[1] ?? 'message';
      const data = /^data: (.*)$/m.exec(block)?.[1];
      return { event: ev, data: data ? JSON.parse(data) : null };
    });
}

describe('v2', () => {
  it('POST /v2/interactions returns the typed report', async () => {
    const env = await makeHttpEnv();
    happy(env);
    const res = await env.json('/v2/interactions', 'POST', { drugs: ['Warfarin', 'Ibuprofen'] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Value.Check(InteractionReportSchema, body)).toBe(true);
    expect(body.overall_risk).toBe('high');
  });

  it('accepts a product with ingredients next to a plain drug name', async () => {
    const env = await makeHttpEnv();
    env.setResponses([call('check_interactions', { drugs: [] }), call('submit_report', draft([{ a: 'Supp', b: 'Warfarin', severity: 'moderate', explanation: 'x' }]))]);
    const res = await env.json('/v2/interactions', 'POST', { drugs: [{ name: 'Supp', ingredients: ['Ibuprofen', 'Dried yeast'] }, 'Warfarin'] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Value.Check(InteractionReportSchema, body)).toBe(true);
    expect(body.pairs).toHaveLength(1);
    expect(body.pairs[0]).toMatchObject({ a: 'Supp', b: 'Warfarin', status: 'interaction' });
    expect(body.pairs[0].ingredient_pairs).toHaveLength(1);
    const bad = await env.json('/v2/interactions', 'POST', { drugs: [{ name: 'Supp', ingredients: [''] }, 'Warfarin'] });
    expect(bad.status).toBe(400);
  });

  it('accepts { text }', async () => {
    const env = await makeHttpEnv();
    happy(env);
    expect((await env.json('/v2/interactions', 'POST', { text: 'warfarin va ibuprofen' })).status).toBe(200);
  });

  it('error envelope with codes', async () => {
    const env = await makeHttpEnv();
    const v = await env.json('/v2/interactions', 'POST', { drugs: ['only-one'] });
    expect(v.status).toBe(400);
    expect((await v.json()).error.code).toBe('VALIDATION');
    env.setResponses([fauxAssistantMessage('nothing')]);
    const n = await env.json('/v2/interactions', 'POST', { text: 'x' });
    expect(n.status).toBe(502);
    expect(await n.json()).toEqual({ error: { code: 'AGENT_NO_REPORT', message: 'Agent finished without submitting a report' } });
    env.setResponses([fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'down' })]);
    const u = await env.json('/v2/interactions', 'POST', { text: 'x' });
    expect(u.status).toBe(502);
    expect((await u.json()).error.code).toBe('UPSTREAM_LLM');
    expect((await env.json('/v2/nope', 'GET')).status).toBe(404);
  });

  it('timeout maps to 504 AGENT_TIMEOUT', async () => {
    const env = await makeHttpEnv({ queryTimeoutMs: 1000 });
    env.setResponses([async () => { await new Promise((r) => setTimeout(r, 1500)); return fauxAssistantMessage('late'); }]);
    const res = await env.json('/v2/interactions', 'POST', { text: 'x' });
    expect(res.status).toBe(504);
    expect((await res.json()).error.code).toBe('AGENT_TIMEOUT');
  });

  it('SSE stream: progress events then report', async () => {
    const env = await makeHttpEnv();
    happy(env);
    const res = await env.json('/v2/interactions/stream', 'POST', { drugs: ['Warfarin', 'Ibuprofen'] });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const events = parseSse(await res.text());
    const kinds = events.map((e) => e.event);
    expect(kinds.at(-1)).toBe('report');
    expect(kinds.filter((k) => k === 'progress').length).toBeGreaterThanOrEqual(8);
    const progress = events.filter((e) => e.event === 'progress').map((e) => e.data.type);
    expect(progress).toContain('resolved');
    expect(progress).toContain('pairs');
    expect(progress.indexOf('resolved')).toBeLessThan(progress.indexOf('pairs'));
    expect(Value.Check(InteractionReportSchema, events.at(-1)!.data)).toBe(true);
  });

  it('SSE stream: failure sends an error event', async () => {
    const env = await makeHttpEnv();
    env.setResponses([fauxAssistantMessage('nothing')]);
    const events = parseSse(await (await env.json('/v2/interactions/stream', 'POST', { text: 'x' })).text());
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { error: { code: 'AGENT_NO_REPORT' } } });
  });

  it('v2 chat + sessions', async () => {
    const env = await makeHttpEnv();
    env.setResponses([fauxAssistantMessage('Xin chào!')]);
    const res = await env.json('/v2/chat', 'POST', { question: 'Chào', session_id: 'abc' });
    expect(await res.json()).toEqual({ answer: 'Xin chào!', session_id: 'abc' });
    const s = await (await env.json('/v2/sessions/abc', 'GET')).json();
    expect(s).toMatchObject({ id: 'abc', has_report: false });
    expect(s.messages).toEqual([{ role: 'user', text: 'Chào' }, { role: 'assistant', text: 'Xin chào!' }]);
    const nf = await env.json('/v2/sessions/zzz', 'GET');
    expect(nf.status).toBe(404);
    expect((await nf.json()).error.code).toBe('NOT_FOUND');
  });
});
