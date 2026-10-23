import { describe, expect, it, vi } from 'vitest';
import {
  DRUGS_COM_DOMAIN,
  LONGCHAU_DOMAIN,
  link,
  slugify,
  type LinkCache,
  type LinkInfo,
  type SiteSearchFn,
} from '../../src/domain/links.ts';

const memCache = () => {
  const store = new Map<string, LinkInfo>();
  const ttls: number[] = [];
  const cache: LinkCache = { get: (k) => store.get(k), set: (k, v, ttl) => (store.set(k, v), void ttls.push(ttl)) };
  return { cache, store, ttls };
};

describe('links', () => {
  it('slugifies', () => {
    expect(slugify('Acetylsalicylic acid')).toBe('acetylsalicylic-acid');
    expect(slugify('St. John’s wort (extract)')).toBe('st-john-s-wort-extract');
  });

  it('prefers nhathuoclongchau.com.vn and does not search drugs.com when it has a page', async () => {
    const searchSite = vi.fn<SiteSearchFn>(async (_n, domain) =>
      domain === LONGCHAU_DOMAIN ? { url: 'https://nhathuoclongchau.com.vn/thanh-phan/warfarin', title: 'Warfarin' } : { url: 'https://www.drugs.com/warfarin.html', title: 'w' },
    );
    const l = await link('Warfarin', { searchSite });
    expect(l).toEqual({ url: 'https://nhathuoclongchau.com.vn/thanh-phan/warfarin', title: 'Warfarin', verified: true, source: 'longchau' });
    expect(searchSite).toHaveBeenCalledTimes(1);
  });

  it('falls back to a drugs.com page found by search (not a guessed slug)', async () => {
    const searchSite: SiteSearchFn = async (_n, domain) => (domain === DRUGS_COM_DOMAIN ? { url: 'https://www.drugs.com/aspirin.html', title: 'Aspirin' } : null);
    const l = await link('Acetylsalicylic acid', { searchSite });
    expect(l).toMatchObject({ url: 'https://www.drugs.com/aspirin.html', verified: true, source: 'drugs.com' });
  });

  it('with no page anywhere, returns an honest drugs.com search URL, unverified and cached briefly', async () => {
    const { cache, ttls } = memCache();
    const l = await link('Potassium alum', { cache, searchSite: async () => null });
    expect(l).toEqual({ url: 'https://www.drugs.com/search.php?searchterm=Potassium%20alum', verified: false, source: 'drugs.com-search' });
    expect(ttls).toEqual([3600 * 1000]);
  });

  it('a throwing search degrades to the next source instead of failing', async () => {
    const searchSite: SiteSearchFn = async (_n, domain) => {
      if (domain === LONGCHAU_DOMAIN) throw new Error('boom');
      return { url: 'https://www.drugs.com/ibuprofen.html', title: 'Ibuprofen' };
    };
    expect((await link('Ibuprofen', { searchSite })).source).toBe('drugs.com');
  });

  it('caches, and ignores entries written by the old slug-guessing code', async () => {
    const { cache, store } = memCache();
    store.set('warfarin', { url: 'https://www.drugs.com/warfarin.html', verified: false }); // legacy key
    const searchSite = vi.fn<SiteSearchFn>(async () => ({ url: 'https://nhathuoclongchau.com.vn/x', title: 'x' }));
    await link('Warfarin', { cache, searchSite });
    await link('Warfarin', { cache, searchSite });
    expect(searchSite).toHaveBeenCalledTimes(1);
  });

  it('no search function configured: search URL only', async () => {
    expect((await link('Foo')).source).toBe('drugs.com-search');
  });
});

describe('createOpenAiSiteSearch', () => {
  const fakeClient = (output_text: string, urls: string[]) => {
    const create = vi.fn(async (_body: any) => ({
      output_text,
      output: [{ type: 'message', content: [{ type: 'output_text', annotations: urls.map((url) => ({ type: 'url_citation', url, title: 'T' })) }] }],
    }));
    return { create, client: { responses: { create } } as any };
  };

  it('restricts the search to the domain, skips off-domain/home citations and strips utm params', async () => {
    const { createOpenAiSiteSearch } = await import('../../src/llm/web-search.ts');
    const f = fakeClient('Trang về warfarin', ['https://example.com/x', 'https://nhathuoclongchau.com.vn/', 'https://nhathuoclongchau.com.vn/thanh-phan/warfarin?utm_source=openai#top']);
    const r = await createOpenAiSiteSearch({ apiKey: 'k', model: 'm', client: f.client })('Warfarin', LONGCHAU_DOMAIN);
    expect(r).toEqual({ url: 'https://nhathuoclongchau.com.vn/thanh-phan/warfarin', title: 'T' });
    expect(f.create.mock.calls[0]![0].tools).toEqual([{ type: 'web_search', filters: { allowed_domains: [LONGCHAU_DOMAIN] } }]);
  });

  it('returns null when the model answers NONE, or cites nothing on the domain', async () => {
    const { createOpenAiSiteSearch } = await import('../../src/llm/web-search.ts');
    const none = fakeClient('NONE', ['https://nhathuoclongchau.com.vn/x']);
    expect(await createOpenAiSiteSearch({ apiKey: 'k', model: 'm', client: none.client })('Foo', LONGCHAU_DOMAIN)).toBeNull();
    const off = fakeClient('ok', ['https://example.com/x']);
    expect(await createOpenAiSiteSearch({ apiKey: 'k', model: 'm', client: off.client })('Foo', LONGCHAU_DOMAIN)).toBeNull();
  });
});
