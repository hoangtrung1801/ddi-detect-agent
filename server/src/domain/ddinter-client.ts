import { setTimeout as sleep } from 'node:timers/promises';

export const DDINTER_BASE_URL = 'https://ddinter2.scbdd.com';

export interface DdinterClientOptions {
  /** Local HTTP server seam for deterministic tests. CLIs always use DDInter. */
  baseUrl?: string;
  /** Minimum spacing between request starts, shared by every caller of this client. */
  intervalMs?: number;
  signal?: AbortSignal;
  /** Called with the epoch-ms deadline when the site answers 429, before the client halts. */
  onRateLimited?: (until: number) => void;
}

export interface DdinterClient {
  readonly base: string;
  /** The access-denied or rate-limit error that stopped this client, if any. */
  readonly halted: Error | undefined;
  /** GET, or a form POST carrying the public CSRF token when `body` is given. */
  request(path: string, body?: URLSearchParams): Promise<Response>;
  /** Stop unless robots.txt is absent or allows the crawl. */
  checkRobots(): Promise<void>;
  /** Read the CSRF token the public listing page embeds for its own DataTables requests. */
  bootstrapListingToken(): Promise<void>;
}

/**
 * Polite DDInter HTTP client shared by the crawlers: evenly spaced request starts, bounded
 * retry with backoff for transient failures, a hard stop on 401/403 (no bypass) and on 429
 * (the Retry-After deadline is handed to the caller to persist).
 */
export function createDdinterClient(options: DdinterClientOptions = {}): DdinterClient {
  const base = options.baseUrl ?? DDINTER_BASE_URL;
  const intervalMs = options.intervalMs ?? 250;
  let cookie = '';
  let token = '';
  let nextSlot = 0;
  let halted: Error | undefined;
  const request = async (path: string, body?: URLSearchParams): Promise<Response> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      options.signal?.throwIfAborted();
      if (halted) throw halted;
      // Reserve the next start slot synchronously so concurrent workers stay evenly spaced.
      const slot = Math.max(nextSlot, Date.now());
      nextSlot = slot + intervalMs;
      if (slot > Date.now()) await sleep(slot - Date.now(), undefined, { signal: options.signal });
      if (halted) throw halted;
      const headers = new Headers({ 'User-Agent': 'DDI-Research-Enrichment/1.0 (+https://github.com/hoangtrung1801/ddi-detect-agent)', Referer: `${base}/server/interaction/` });
      if (cookie) headers.set('Cookie', cookie);
      if (body) { body.set('csrfmiddlewaretoken', token); headers.set('Content-Type', 'application/x-www-form-urlencoded'); }
      let response: Response;
      try {
        response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers, body, signal: AbortSignal.any([AbortSignal.timeout(60000), ...(options.signal ? [options.signal] : [])]) });
      } catch (error) {
        // Timeouts and dropped connections are transient; a user abort or an exhausted retry budget still fails.
        if (options.signal?.aborted || attempt >= 2) throw error;
        await sleep(2000 * 2 ** attempt, undefined, { signal: options.signal });
        continue;
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length) cookie = cookies.map((c) => c.split(';')[0]).join('; ');
      if (response.status === 429) {
        const value = response.headers.get('retry-after');
        const until = value && /^\d+$/.test(value) ? Date.now() + Number(value) * 1000 : value ? Date.parse(value) : Date.now() + 60000;
        options.onRateLimited?.(Number.isFinite(until) ? until : Date.now() + 60000);
        await response.body?.cancel();
        throw (halted = new Error('HTTP 429: crawl paused; resume after the Retry-After deadline recorded in the archive'));
      }
      if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw (halted = new Error(`HTTP ${response.status}: access denied; no bypass attempted`)); }
      if (response.status >= 500 && attempt < 2) { await response.body?.cancel(); await sleep(2000 * 2 ** attempt, undefined, { signal: options.signal }); continue; }
      return response;
    }
    throw new Error('Request retry exhausted');
  };
  return {
    base,
    get halted() { return halted; },
    request,
    async checkRobots() {
      const robots = await request('/robots.txt');
      if (robots.status === 404) { await robots.body?.cancel(); return; }
      if (!robots.ok || /^\s*Disallow:\s*\/\S*/im.test(await robots.text())) throw new Error('robots.txt requires manual access-rule review; crawl paused');
    },
    async bootstrapListingToken() {
      const bootstrap = await request('/server/interaction/');
      if (!bootstrap.ok) throw new Error(`Listing bootstrap HTTP ${bootstrap.status}`);
      const html = await bootstrap.text();
      token = html.match(/csrfmiddlewaretoken:\s*'([^']+)'/)?.[1] ?? '';
      // The public listing currently supplies an embedded token but no Set-Cookie header.
      // Send only session material actually issued by the site; a 401/403 always stops the crawl.
      if (!token) throw new Error('Public listing did not supply its normal CSRF token; no bypass attempted');
    },
  };
}
