import OpenAI from 'openai';
import type { SiteSearchFn } from '../domain/links.ts';

export interface WebSearchResult {
  text: string;
  sources: { url: string; title: string }[];
}

export type WebSearchFn = (query: string, signal?: AbortSignal) => Promise<WebSearchResult>;

/** pi-ai has no web search, so wrap the OpenAI Responses API `web_search` tool. */
export function createOpenAiWebSearch(opts: { apiKey: string; model: string; client?: OpenAI }): WebSearchFn {
  const client = opts.client ?? new OpenAI({ apiKey: opts.apiKey });
  return async (query, signal) => {
    const res = await client.responses.create(
      {
        model: opts.model,
        tools: [{ type: 'web_search' }],
        input: `Search the web and answer concisely and factually with sources. Question: ${query}`,
      },
      signal ? { signal } : undefined,
    );
    const sources = new Map<string, string>();
    for (const item of res.output) {
      if (item.type !== 'message') continue;
      for (const part of item.content) {
        if (part.type !== 'output_text') continue;
        for (const a of part.annotations ?? []) {
          if (a.type === 'url_citation') sources.set(a.url, a.title ?? a.url);
        }
      }
    }
    return { text: res.output_text, sources: [...sources].map(([url, title]) => ({ url, title })) };
  };
}

/** Drop tracking params the search tool appends (utm_source=openai) and the fragment. */
function cleanUrl(raw: string): string {
  const u = new URL(raw);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
  u.hash = '';
  return u.toString();
}

/** Web search restricted to one domain; returns the best page specifically about a drug. Only URLs the search cited are returned. */
export function createOpenAiSiteSearch(opts: { apiKey: string; model: string; client?: OpenAI }): SiteSearchFn {
  const client = opts.client ?? new OpenAI({ apiKey: opts.apiKey });
  return async (name, domain, signal) => {
    const res = await client.responses.create(
      {
        model: opts.model,
        tools: [{ type: 'web_search', filters: { allowed_domains: [domain] } }],
        input:
          `Find the single best page on ${domain} that is specifically about the drug or active ingredient "${name}" ` +
          `(try its Vietnamese name too, or a product whose main ingredient it is). Cite only that page. ` +
          `If no page is specifically about it, answer exactly NONE and cite nothing.`,
      },
      signal ? { signal } : undefined,
    );
    if (/^\s*none\b/i.test(res.output_text)) return null;
    for (const item of res.output) {
      if (item.type !== 'message') continue;
      for (const part of item.content) {
        if (part.type !== 'output_text') continue;
        for (const a of part.annotations ?? []) {
          if (a.type !== 'url_citation') continue;
          let u: URL;
          try {
            u = new URL(a.url);
          } catch {
            continue;
          }
          const onDomain = u.hostname === domain || u.hostname.endsWith(`.${domain}`);
          if (onDomain && u.pathname !== '/') return { url: cleanUrl(a.url), title: a.title ?? name };
        }
      }
    }
    return null;
  };
}
