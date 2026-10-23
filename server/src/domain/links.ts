export type LinkSource = 'longchau' | 'drugs.com' | 'drugs.com-search';

export interface LinkInfo {
  url: string;
  /** True when the URL is a specific page that a search actually returned. False for the generic search fallback. */
  verified: boolean;
  source?: LinkSource;
  title?: string;
}

export interface LinkCache {
  get(key: string): LinkInfo | undefined;
  set(key: string, value: LinkInfo, ttlMs: number): void;
}

export const LINK_TTL_MS = 30 * 24 * 3600 * 1000;
/** The fallback may only be a temporary miss (search error, rate limit), so it is retried soon. */
const FALLBACK_TTL_MS = 3600 * 1000;

export const LONGCHAU_DOMAIN = 'nhathuoclongchau.com.vn';
export const DRUGS_COM_DOMAIN = 'drugs.com';

export interface SitePage {
  url: string;
  title: string;
}

/** Finds the page on `domain` that is specifically about the drug `name`, or null. Implemented with a domain-restricted web search. */
export type SiteSearchFn = (name: string, domain: string, signal?: AbortSignal) => Promise<SitePage | null>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface LinkOptions {
  cache?: LinkCache;
  searchSite?: SiteSearchFn;
  timeoutMs?: number;
}

/**
 * Reference link for a drug. Pages are looked up, never guessed from the name (drugs.com slugs rarely match database
 * names and the site blocks automated checks). Order: nhathuoclongchau.com.vn, then drugs.com, then a drugs.com search URL.
 */
export async function link(dbName: string, opts: LinkOptions = {}): Promise<LinkInfo> {
  // "v2" keeps entries written by the old slug-guessing implementation from being served.
  const key = `v2:${slugify(dbName)}`;
  const cached = opts.cache?.get(key);
  if (cached) return cached;

  const find = async (domain: string): Promise<SitePage | null> => {
    if (!opts.searchSite) return null;
    try {
      return await opts.searchSite(dbName, domain, AbortSignal.timeout(opts.timeoutMs ?? 25_000));
    } catch {
      return null;
    }
  };

  const longchau = await find(LONGCHAU_DOMAIN);
  if (longchau) return remember(opts, key, { url: longchau.url, title: longchau.title, verified: true, source: 'longchau' });
  const drugs = await find(DRUGS_COM_DOMAIN);
  if (drugs) return remember(opts, key, { url: drugs.url, title: drugs.title, verified: true, source: 'drugs.com' });
  return remember(
    opts,
    key,
    { url: `https://www.drugs.com/search.php?searchterm=${encodeURIComponent(dbName)}`, verified: false, source: 'drugs.com-search' },
    FALLBACK_TTL_MS,
  );
}

function remember(opts: LinkOptions, key: string, info: LinkInfo, ttl = LINK_TTL_MS): LinkInfo {
  opts.cache?.set(key, info, ttl);
  return info;
}

/** Process-local TTL cache (used by tools/eval; the server uses the SQLite cache). */
export function memoryLinkCache(): LinkCache {
  const m = new Map<string, { v: LinkInfo; exp: number }>();
  return {
    get(k) {
      const e = m.get(k);
      return e && e.exp > Date.now() ? e.v : undefined;
    },
    set(k, v, ttl) {
      m.set(k, { v, exp: Date.now() + ttl });
    },
  };
}
