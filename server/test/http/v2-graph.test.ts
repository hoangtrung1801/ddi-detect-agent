import { describe, expect, it } from 'vitest';
import { makeHttpEnv } from '../helpers/http-env.ts';

describe('v2 graph', () => {
  it('GET /v2/graph returns the named drugs, their partners and every interaction among them', async () => {
    const env = await makeHttpEnv();
    const res = await env.json('/v2/graph?drugs=Warfarin,Nonexistium', 'GET');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resolved).toEqual([{ input: 'Warfarin', name: 'Warfarin' }]);
    expect(body.unresolved).toEqual(['Nonexistium']);
    const ids = body.nodes.map((n: any) => n.id).sort();
    expect(ids).toEqual(['Acetaminophen', 'Acetylsalicylic acid', 'Ibuprofen', 'Warfarin']);
    expect(body.nodes.find((n: any) => n.id === 'Warfarin')).toEqual({ id: 'Warfarin', degree: 3, seed: true });
    // Warfarin's three edges plus Ibuprofen–Aspirin between two partners; links point from the drug named first.
    expect(body.links).toHaveLength(4);
    expect(body.links).toContainEqual({
      source: 'Ibuprofen',
      target: 'Acetylsalicylic acid',
      condition: 'The risk or severity of gastrointestinal bleeding can be increased when Ibuprofen is combined with Acetylsalicylic acid.',
    });
  });

  it('GET /v2/graph with neighbors=0 keeps only the named drugs', async () => {
    const env = await makeHttpEnv();
    const body = await (await env.json('/v2/graph?drugs=Warfarin,Ibuprofen&neighbors=0', 'GET')).json();
    expect(body.nodes.map((n: any) => n.id)).toEqual(['Warfarin', 'Ibuprofen']);
    expect(body.links).toHaveLength(1);
  });

  it('GET /v2/graph with no drugs returns the hubs, all marked as seeds', async () => {
    const env = await makeHttpEnv();
    const body = await (await env.json('/v2/graph?hubs=3', 'GET')).json();
    expect(body.nodes[0]).toEqual({ id: 'Warfarin', degree: 3, seed: true });
    expect(body.nodes).toHaveLength(3);
    expect(body.nodes.every((n: any) => n.seed)).toBe(true);
  });

  it('GET /v2/graph rejects more than 10 drugs', async () => {
    const env = await makeHttpEnv();
    const res = await env.json(`/v2/graph?drugs=${Array.from({ length: 11 }, (_, i) => `d${i}`).join(',')}`, 'GET');
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });

  it('GET /v2/drugs/search ranks prefix matches first', async () => {
    const env = await makeHttpEnv();
    const body = await (await env.json('/v2/drugs/search?q=war', 'GET')).json();
    expect(body.results).toEqual([{ name: 'Warfarin', degree: 3 }]);
    const none = await (await env.json('/v2/drugs/search?q=', 'GET')).json();
    expect(none.results).toEqual([]);
  });
});
