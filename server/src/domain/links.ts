export interface LinkInfo {
  url: string;
  verified: boolean;
}

export interface LinkCache {
  get(key: string): LinkInfo | undefined;
  set(key: string, value: LinkInfo, ttlMs: number): void;
}

export const LINK_TTL_MS = 30 * 24 * 3600 * 1000;

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
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/** drugs.com slug link; `verified` is true only when a HEAD request returned 2xx. Failures yield an unverified link. */
export async function link(dbName: string, opts: LinkOptions = {}): Promise<LinkInfo> {
  const slug = slugify(dbName);
  const url = `https://www.drugs.com/${slug}.html`;
  const cached = opts.cache?.get(slug);
  if (cached) return cached;
  let verified = false;
  try {
    const res = await (opts.fetchFn ?? fetch)(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ddi-server/0.1)' },
    });
    verified = res.ok;
  } catch {
    verified = false;
  }
  const info = { url, verified };
  // Only cache positive checks long-term; unverified results may be a temporary block.
  opts.cache?.set(slug, info, verified ? LINK_TTL_MS : 3600 * 1000);
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
