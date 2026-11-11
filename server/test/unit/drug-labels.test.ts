import { describe, expect, it } from 'vitest';
import { bestLabel, excerpt, fetchLabel, mentioning, parseLabel, type DrugLabel } from '../../src/domain/drug-labels.ts';
import { literatureLink } from '../../src/agent/evidence.ts';

const raw = {
  set_id: 'abc-123',
  effective_time: '20240101',
  openfda: { generic_name: ['WARFARIN SODIUM'] },
  mechanism_of_action: ['12.1 Mechanism of Action  Warfarin acts by inhibiting   VKORC1.'],
  drug_interactions: ['Drugs that increase bleeding risk. Clopidogrel increases bleeding. Unrelated text here.'],
};

describe('FDA labels', () => {
  it('parses sections and links the DailyMed page of the set id', () => {
    const l = parseLabel('Warfarin', raw)!;
    expect(l.url).toBe('https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=abc-123');
    expect(l.generic).toBe('WARFARIN SODIUM');
    expect(l.sections.mechanism).toBe('12.1 Mechanism of Action Warfarin acts by inhibiting VKORC1.');
    expect(parseLabel('X', { openfda: {} })).toBeNull();
  });

  it('keeps only sentences mentioning the partner drug, and cuts excerpts at sentence ends', () => {
    expect(mentioning(raw.drug_interactions[0], ['clopidogrel'], 500)).toBe('Clopidogrel increases bleeding.');
    expect(mentioning(raw.drug_interactions[0], ['aspirin'], 500)).toBeUndefined();
    expect(excerpt('One two three. Four five six seven.', 20)).toBe('One two three.…');
  });

  it('falls back through queries, caches hits, and does not cache transient failures', async () => {
    const store = new Map<string, DrugLabel | null>();
    const cache = { get: (k: string) => store.get(k), set: (k: string, v: DrugLabel | null) => void store.set(k, v) };
    const urls: string[] = [];
    const ok = async (u: string | URL | Request) => {
      urls.push(String(u));
      return urls.length === 1 ? new Response('{}', { status: 404 }) : Response.json({ results: [raw] });
    };
    expect((await fetchLabel('Warfarin', { cache, fetchFn: ok as typeof fetch }))?.setId).toBe('abc-123');
    expect(urls).toHaveLength(3); // all queries run at once; the first that matched wins
    expect(await fetchLabel('Warfarin', { cache, fetchFn: (() => { throw new Error('no'); }) as typeof fetch })).not.toBeNull();
    const down = (async () => new Response('', { status: 500 })) as typeof fetch;
    expect(await fetchLabel('Other', { cache, fetchFn: down })).toBeNull();
    expect(store.has('v3:other')).toBe(false);
  });

  it('prefers a single-ingredient label over a combination product', () => {
    const combo = { set_id: 'combo', openfda: { generic_name: ['HYDROCODONE BITARTRATE AND ACETAMINOPHEN'], substance_name: ['HYDROCODONE', 'ACETAMINOPHEN'] } };
    const solo = { set_id: 'solo', openfda: { generic_name: ['ACETAMINOPHEN'], substance_name: ['ACETAMINOPHEN'] } };
    expect(bestLabel('Acetaminophen', 'acetaminophen', [combo, solo])).toMatchObject({ setId: 'solo', single: true });
    expect(bestLabel('Acetaminophen', 'acetaminophen', [combo])).toMatchObject({ setId: 'combo', single: false });
  });

  it('looks up international names under their US label name', async () => {
    const urls: string[] = [];
    const f = (async (u: string | URL | Request) => {
      urls.push(decodeURIComponent(String(u)));
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    expect(await fetchLabel('Acetylsalicylic acid', { fetchFn: f })).toBeNull();
    expect(urls.every((u) => u.includes('"aspirin"'))).toBe(true);
  });

  it('links literature directly when it has a PMID or DOI, else via PubMed search', () => {
    expect(literatureLink('Smith J. Title. PMID: 12345678')).toEqual({ url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/', link: 'direct' });
    expect(literatureLink('Doe A. Title. doi:10.1001/jama.2020.1234.')).toEqual({ url: 'https://doi.org/10.1001/jama.2020.1234', link: 'direct' });
    expect(literatureLink('Product Information. Plavix').link).toBe('search');
  });
});
