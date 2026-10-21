import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from 'typebox';
import type { WebSearchFn } from '../../llm/web-search.ts';

const Params = Type.Object({ query: Type.String({ minLength: 3, description: 'Search query (English works best for medical sources)' }) });

export function makeWebSearchTool(search: WebSearchFn): AgentTool<typeof Params> {
  return {
    name: 'web_search',
    label: 'Web search',
    description: 'Search the web for medical facts that are not in the interaction database (mechanisms, dosing, food or supplement effects).',
    parameters: Params,
    execute: async (_id, params, signal) => {
      const r = await search(params.query, signal);
      const text = r.text + (r.sources.length ? '\n\nSources:\n' + r.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n') : '');
      return { content: [{ type: 'text', text }], details: r };
    },
  };
}
