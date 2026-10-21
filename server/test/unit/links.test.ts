import { describe, expect, it, vi } from 'vitest';
import { link, slugify, type LinkCache, type LinkInfo } from '../../src/domain/links.ts';

describe('links', () => {
  it('slugifies', () => {
    expect(slugify('Acetylsalicylic acid')).toBe('acetylsalicylic-acid');
    expect(slugify('St. John’s wort (extract)')).toBe('st-john-s-wort-extract');
  });
  it('verifies via HEAD and caches', async () => {
    const store = new Map<string, LinkInfo>();
    const cache: LinkCache = { get: (k) => store.get(k), set: (k, v) => void store.set(k, v) };
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    const a = await link('Warfarin', { cache, fetchFn });
    expect(a).toEqual({ url: 'https://www.drugs.com/warfarin.html', verified: true });
    await link('Warfarin', { cache, fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('returns an unverified link on 404 or network failure', async () => {
    const f404 = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    expect((await link('Foo', { fetchFn: f404 })).verified).toBe(false);
    const fErr = (async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    expect(await link('Foo bar', { fetchFn: fErr })).toEqual({ url: 'https://www.drugs.com/foo-bar.html', verified: false });
  });
});
