import OpenAI from 'openai';

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
