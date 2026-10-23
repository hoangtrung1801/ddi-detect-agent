import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { call } from '../helpers/agent-env.ts';
import * as C from '../helpers/contract.ts';
import { makeHttpEnv } from '../helpers/http-env.ts';

const draft = (pairs: any[] = []) => ({ title: 'Kết quả', pairs, recommendations: ['Hỏi dược sĩ.'] });
const shape = (schema: any, v: unknown) => {
  const errs = [...Value.Errors(schema, v)].map((e) => `${e.instancePath}: ${e.message}`);
  expect(errs).toEqual([]);
};

describe('v1 system', () => {
  it('GET /health, /, /stats', async () => {
    const env = await makeHttpEnv();
    const h = await env.json('/health', 'GET');
    expect(h.status).toBe(200);
    const hb = await h.json();
    shape(C.HealthShape, hb);
    expect(hb.status).toBe('healthy');
    const root = await (await env.json('/', 'GET')).json();
    expect(root).toMatchObject({ health: '/health', stats: '/stats' });
    const st = await (await env.json('/stats', 'GET')).json();
    shape(C.StatsShape, st);
    expect(st).toMatchObject({ total_drugs: 10, total_interactions: 8, active_sessions: 0 });
  });

  it('CORS: allowed origin is echoed with credentials; others are not', async () => {
    const env = await makeHttpEnv();
    const ok = await env.request('/health', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(ok.headers.get('access-control-allow-credentials')).toBe('true');
    const bad = await env.request('/health', { method: 'GET', headers: { origin: 'http://evil.example' } });
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('v1 /query', () => {
  const script = (env: Awaited<ReturnType<typeof makeHttpEnv>>, drugs: any[], names: string[]) =>
    env.setResponses([
      call('resolve_drugs', { drugs }),
      call('check_interactions', { drugs: names }),
      call('submit_report', draft([{ a: names[0], b: names[1], severity: 'major', explanation: 'Tăng nguy cơ chảy máu.' }])),
    ]);

  it('returns answer, drug_links and parsed_result in the legacy shape', async () => {
    const env = await makeHttpEnv();
    script(env, [{ input: 'Tylenol', generic_guess: 'acetaminophen' }, { input: 'Coumadin' }], ['Acetaminophen', 'Warfarin']);
    const res = await env.json('/query', 'POST', { question: 'Tylenol and Coumadin?' });
    expect(res.status).toBe(200);
    const body = await res.json();
    shape(C.QueryResponseShape, body);
    expect(body.answer).toContain('### Tóm Tắt Cuối Cùng');
    expect(body.drug_links).toEqual({
      Acetaminophen: 'https://www.drugs.com/acetaminophen.html',
      Warfarin: 'https://www.drugs.com/warfarin.html',
    });
    const pr = body.parsed_result;
    expect(pr.drug_conversion).toEqual([
      { original: 'Tylenol', converted: 'Acetaminophen', reference: { name: 'Acetaminophen', link: 'https://www.drugs.com/acetaminophen.html' } },
      { original: 'Coumadin', converted: 'Warfarin', reference: { name: 'Warfarin', link: 'https://www.drugs.com/warfarin.html' } },
    ]);
    expect(pr.interactions).toHaveLength(1);
    expect(pr.interactions[0]).toMatchObject({ drug1: 'Acetaminophen', drug2: 'Warfarin', status: 'Có Tương Tác' });
    expect(pr.interactions[0].details).toContain('Tăng nguy cơ chảy máu.');
    expect(pr.summary.overall_risk).toBe('Cao');
    expect(pr.summary.major_interactions).toEqual(['Acetaminophen + Warfarin (mức độ: nghiêm trọng)']);
    expect(pr.summary.recommendations).toEqual(['Hỏi dược sĩ.']);
  });

  it('maps no_record and unresolved pairs to the unknown statuses, never to "An Toàn"', async () => {
    const env = await makeHttpEnv();
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Digoxin' }, { input: 'Cetirizine' }, { input: 'Zzyzxtol' }] }),
      call('check_interactions', { drugs: ['Digoxin', 'Cetirizine'] }),
      call('submit_report', draft()),
    ]);
    const body = await (await env.json('/query', 'POST', { question: 'x' })).json();
    shape(C.QueryResponseShape, body);
    const st = Object.fromEntries(body.parsed_result.interactions.map((i: any) => [`${i.drug1}|${i.drug2}`, i.status]));
    expect(st['Digoxin|Cetirizine']).toBe('Không có dữ liệu');
    expect(st['Digoxin|Zzyzxtol']).toBe('Không xác định');
    expect(st['Cetirizine|Zzyzxtol']).toBe('Không xác định');
    expect(JSON.stringify(body)).not.toContain('"An Toàn"');
    expect(body.parsed_result.summary.overall_risk).toBe('Không xác định');
    expect(body.parsed_result.drug_conversion.find((d: any) => d.original === 'Zzyzxtol')).toMatchObject({ converted: 'Không xác định', reference: null });
  });

  it('validation errors use FastAPI-style 422 detail', async () => {
    const env = await makeHttpEnv();
    const r1 = await env.json('/query', 'POST', { question: '' });
    expect(r1.status).toBe(422);
    const b1 = await r1.json();
    expect(Array.isArray(b1.detail)).toBe(true);
    expect(b1.detail[0]).toMatchObject({ loc: ['body', 'question'] });
    expect((await env.json('/query', 'POST', {})).status).toBe(422);
    expect((await env.json('/query', 'POST', '{not json')).status).toBe(422);
  });

  it('agent failure: 500 with {detail}', async () => {
    const env = await makeHttpEnv();
    env.setResponses([fauxAssistantMessage('text only')]);
    const res = await env.json('/query', 'POST', { question: 'x' });
    expect(res.status).toBe(500);
    expect((await res.json()).detail).toMatch(/^Error processing query:/);
  });

  it('/query-translate is gone (410)', async () => {
    const env = await makeHttpEnv();
    const res = await env.json('/query-translate', 'POST', { question: 'x' });
    expect(res.status).toBe(410);
  });

  it('unknown route: 404 {detail}', async () => {
    const env = await makeHttpEnv();
    const res = await env.json('/nope', 'GET');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: 'Not Found' });
  });
});

describe('v1 /chat', () => {
  it('uses the last /query report as context, keeps history per session, and DELETE clears it', async () => {
    const env = await makeHttpEnv();
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Warfarin' }, { input: 'Ibuprofen' }] }),
      call('check_interactions', { drugs: ['Warfarin', 'Ibuprofen'] }),
      call('submit_report', draft([{ a: 'Warfarin', b: 'Ibuprofen', severity: 'major', explanation: 'Chảy máu.' }])),
    ]);
    await env.json('/query', 'POST', { question: 'Warfarin và Ibuprofen' });

    const seen: { system: string; texts: string[] }[] = [];
    const factory = (answer: string) => (ctx: any) => {
      const sys = ctx.messages.filter((m: any) => m.role === 'system').map((m: any) => (typeof m.content === 'string' ? m.content : m.content.map((p: any) => p.text).join(''))).join('\n');
      const texts = ctx.messages.filter((m: any) => m.role === 'user').map((m: any) => (typeof m.content === 'string' ? m.content : m.content.map((p: any) => p.text).join('')));
      seen.push({ system: sys, texts });
      return fauxAssistantMessage(answer);
    };
    env.setResponses([factory('Câu trả lời 1'), factory('Câu trả lời 2')]);

    const r1 = await env.json('/chat', 'POST', { question: 'Tôi nên làm gì?', session_id: 'optional-session-id' });
    expect(r1.status).toBe(200);
    const b1 = await r1.json();
    shape(C.ChatResponseShape, b1);
    expect(b1).toMatchObject({ answer: 'Câu trả lời 1', session_id: 'optional-session-id' });
    expect(seen[0]!.system).toContain('<report>');
    expect(seen[0]!.system).toContain('Warfarin');

    const r2 = await env.json('/chat', 'POST', { question: 'Còn liều lượng?', session_id: 'optional-session-id' });
    expect((await r2.json()).answer).toBe('Câu trả lời 2');
    expect(seen[1]!.texts).toEqual(['Tôi nên làm gì?', 'Còn liều lượng?']);

    // a different session has no history (but legacy fallback still gives it the report)
    env.setResponses([factory('Khác')]);
    await env.json('/chat', 'POST', { question: 'Phiên mới', session_id: 'other' });
    expect(seen[2]!.texts).toEqual(['Phiên mới']);

    const st = await (await env.json('/stats', 'GET')).json();
    expect(st.active_sessions).toBe(2);

    const del = await env.json('/chat/optional-session-id', 'DELETE');
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ message: 'Session optional-session-id cleared', success: true });
    expect((await env.json('/chat/optional-session-id', 'DELETE')).status).toBe(404);
  });

  it('generates a session id when absent; chat can call tools (resolve + web_search)', async () => {
    const env = await makeHttpEnv({ searchResult: 'Nước bưởi ức chế CYP3A4.' });
    env.setResponses([
      call('resolve_drugs', { drugs: [{ input: 'Warfarin' }] }),
      call('web_search', { query: 'warfarin grapefruit interaction' }),
      fauxAssistantMessage('Nước bưởi có thể ảnh hưởng (nguồn web).'),
    ]);
    const res = await env.json('/chat', 'POST', { question: 'Warfarin và nước bưởi?' });
    expect(res.status).toBe(200);
    const b = await res.json();
    shape(C.ChatResponseShape, b);
    expect(b.session_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.searches).toEqual(['warfarin grapefruit interaction']);
  });

  it('upstream failure: 500 {detail}', async () => {
    const env = await makeHttpEnv();
    env.setResponses([fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'rate limited' })]);
    const res = await env.json('/chat', 'POST', { question: 'x', session_id: 's' });
    expect(res.status).toBe(500);
    expect((await res.json()).detail).toMatch(/rate limited/);
  });
});

describe('v1 drug-name-extract', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const ingredients = (names: string[]) =>
    call('submit_ingredients', { active_ingredients: names.map((name) => ({ name, strength: '500 mg' })) });

  it('accepts a base64 data URL', async () => {
    const env = await makeHttpEnv();
    env.setResponses([ingredients(['Paracetamol', 'Caffeine', 'paracetamol'])]);
    const res = await env.json('/drug-name-extract', 'POST', { image_url: `data:image/png;base64,${png.toString('base64')}` });
    expect(res.status).toBe(200);
    const b = await res.json();
    shape(C.ExtractShape, b);
    expect(b.result).toEqual(['Paracetamol', 'Caffeine']);
  });

  it('returns one product with its ingredients', async () => {
    const env = await makeHttpEnv();
    env.setResponses([call('submit_ingredients', { product_name: ' GH Creation EX+ ', active_ingredients: [{ name: 'L-Lysine', strength: '0.9 mg' }, { name: '[unclear]' }, { name: 'Alpha-GPC' }] })]);
    const res = await env.json('/drug-name-extract', 'POST', { image_url: `data:image/png;base64,${png.toString('base64')}` });
    const b = await res.json();
    shape(C.ExtractShape, b);
    expect(b.product_name).toBe('GH Creation EX+');
    expect(b.ingredients).toEqual([{ name: 'L-Lysine', strength: '0.9 mg' }, { name: 'Alpha-GPC' }]);
    expect(b.result).toEqual(['L-Lysine', 'Alpha-GPC']);
  });

  it('product_name is null when the label has none', async () => {
    const env = await makeHttpEnv();
    env.setResponses([ingredients(['Paracetamol'])]);
    const res = await env.json('/drug-name-extract', 'POST', { image_url: `data:image/png;base64,${png.toString('base64')}` });
    expect((await res.json()).product_name).toBeNull();
  });

  it('returns every ingredient, not just the headline one', async () => {
    const env = await makeHttpEnv();
    const all = ['Collagen peptide', 'Dried yeast', 'L-Arginine', 'L-Leucine', 'Zinc yeast', 'Alpha-GPC'];
    env.setResponses([ingredients(all)]);
    const res = await env.json('/drug-name-extract', 'POST', { image_url: `data:image/png;base64,${png.toString('base64')}` });
    const b = await res.json();
    expect(b.result).toEqual(all);
    expect(b.evidences).toEqual([]);
  });

  it('searches the web for the composition, then submits', async () => {
    const env = await makeHttpEnv();
    env.setResponses([call('web_search', { query: 'GH Creation EX+ ingredients' }), ingredients(['Collagen peptide', 'Alpha-GPC'])]);
    const res = await env.json('/drug-name-extract', 'POST', { image_url: `data:image/png;base64,${png.toString('base64')}` });
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.result).toEqual(['Collagen peptide', 'Alpha-GPC']);
    expect(env.searches).toEqual(['GH Creation EX+ ingredients']);
    expect(b.evidences).toEqual([{ url: 'https://example.org/a', title: 'A', query: 'GH Creation EX+ ingredients' }]);
  });

  it('accepts a multipart upload (no Cloudinary)', async () => {
    const env = await makeHttpEnv();
    env.setResponses([ingredients(['Ibuprofen'])]);
    const fd = new FormData();
    fd.append('file', new File([png], 'label.png', { type: 'image/png' }));
    const res = await env.request('/drug-name-extract/upload', { method: 'POST', body: fd });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toEqual(['Ibuprofen']);
  });

  it('rejects non-images, missing files, oversize files and private URLs', async () => {
    const env = await makeHttpEnv();
    const bad = new FormData();
    bad.append('file', new File(['hello'], 'a.txt', { type: 'text/plain' }));
    expect((await env.request('/drug-name-extract/upload', { method: 'POST', body: bad })).status).toBe(400);
    const none = new FormData();
    none.append('other', 'x');
    expect((await env.request('/drug-name-extract/upload', { method: 'POST', body: none })).status).toBe(400);
    const big = new FormData();
    big.append('file', new File([new Uint8Array(8 * 1024 * 1024 + 10)], 'big.png', { type: 'image/png' }));
    expect((await env.request('/drug-name-extract/upload', { method: 'POST', body: big })).status).toBe(413);
    for (const url of ['http://127.0.0.1/a.png', 'http://169.254.169.254/latest', 'file:///etc/passwd', 'not a url', 'data:text/plain;base64,aGk=']) {
      const r = await env.json('/drug-name-extract', 'POST', { image_url: url });
      expect(r.status, url).toBe(400);
      expect(typeof (await r.json()).detail).toBe('string');
    }
  });

  it('model failure: 500 {detail}', async () => {
    const env = await makeHttpEnv();
    env.setResponses([fauxAssistantMessage('no tool')]);
    const res = await env.json('/drug-name-extract', 'POST', { image_url: `data:image/png;base64,${png.toString('base64')}` });
    expect(res.status).toBe(500);
    expect((await res.json()).detail).toMatch(/^Error processing image:/);
  });
});

describe('v1 /medicine-cabinet', () => {
  it('add / list / interactions / remove / clear with brand names resolved to DB names', async () => {
    const env = await makeHttpEnv();
    const add = async (name: string, user?: string) => (await env.json('/medicine-cabinet/add', 'POST', { drug_name: name, ...(user ? { user_id: user } : {}) })).json();

    const a1 = await add('Tylenol');
    shape(C.AddDrugShape, a1);
    expect(a1).toMatchObject({ success: true, drug_name: 'Acetaminophen', user_id: 'admin', checking_interactions: false });

    const a2 = await add('  COUMADIN ');
    expect(a2).toMatchObject({ success: true, drug_name: 'Warfarin', checking_interactions: true });
    expect(a2.message).toMatch(/1 interaction/);

    const dup = await add('tylenol');
    expect(dup).toMatchObject({ success: false, drug_name: 'Acetaminophen', checking_interactions: false });
    expect(dup.message).toMatch(/already exists/);

    expect(await add('Digoxin')).toMatchObject({ success: true });

    const unk = await add('Zzyzxtol');
    shape(C.AddDrugShape, unk);
    expect(unk.success).toBe(false);

    const list = await (await env.json('/medicine-cabinet/list', 'GET')).json();
    shape(C.CabinetListShape, list);
    expect(list.count).toBe(3);
    const byName = Object.fromEntries(list.drugs.map((d: any) => [d.drug_name, d.interactions]));
    expect(Object.keys(byName)).toEqual(['Acetaminophen', 'Digoxin', 'Warfarin']);
    expect(byName['Digoxin']).toBeNull();
    expect(byName['Warfarin']).toContain('Tương tác giữa Acetaminophen và Warfarin');

    const inter = await env.json('/medicine-cabinet/interactions/Tylenol', 'GET');
    expect(inter.status).toBe(200);
    const ib = await inter.json();
    shape(C.DrugInteractionsShape, ib);
    expect(ib).toMatchObject({ drug_name: 'Acetaminophen', total_interactions: 1 });
    expect(ib.interactions[0]).toMatchObject({ drug1: 'Acetaminophen', drug2: 'Warfarin', has_interaction: true, severity: null });
    expect((await env.json('/medicine-cabinet/interactions/Metformin', 'GET')).status).toBe(404);

    // users are isolated
    expect((await (await env.json('/medicine-cabinet/list?user_id=bob', 'GET')).json()).count).toBe(0);

    const rm = await env.json('/medicine-cabinet/remove/Tylenol', 'DELETE');
    expect(rm.status).toBe(200);
    shape(C.RemoveShape, await rm.json());
    expect((await env.json('/medicine-cabinet/remove/Tylenol', 'DELETE')).status).toBe(404);
    const after = await (await env.json('/medicine-cabinet/list', 'GET')).json();
    expect(after.drugs.map((d: any) => d.drug_name)).toEqual(['Digoxin', 'Warfarin']);
    expect(after.drugs.find((d: any) => d.drug_name === 'Warfarin').interactions).toBeNull();

    const clr = await env.json('/medicine-cabinet/clear', 'DELETE');
    shape(C.ClearShape, await clr.json());
    expect((await (await env.json('/medicine-cabinet/list', 'GET')).json()).count).toBe(0);
  });

  it('validation: empty name 422, whitespace 400', async () => {
    const env = await makeHttpEnv();
    expect((await env.json('/medicine-cabinet/add', 'POST', { drug_name: '' })).status).toBe(422);
    expect((await env.json('/medicine-cabinet/add', 'POST', { drug_name: '   ' })).status).toBe(400);
  });
});
