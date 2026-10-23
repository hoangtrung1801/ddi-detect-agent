import pino from 'pino';
import { createChatAgent } from '../../src/agent/chat-agent.ts';
import { createDdiAgent } from '../../src/agent/ddi-agent.ts';
import { createExtractAgent } from '../../src/agent/extract-agent.ts';
import { slugify } from '../../src/domain/links.ts';
import { createApp } from '../../src/http/app.ts';
import { openAppDb } from '../../src/store/app-db.ts';
import { CabinetStore } from '../../src/store/cabinet.ts';
import { SessionStore } from '../../src/store/sessions.ts';
import { makeDomain } from './domain.ts';
import { makeFauxLlm } from './faux-llm.ts';

/** Response whose json() is loosely typed, for assertions. */
export type Res = Omit<Response, 'json'> & { json(): Promise<any> };

export async function makeHttpEnv(over: { searchResult?: string; queryTimeoutMs?: number } = {}) {
  const dom = await makeDomain();
  const f = makeFauxLlm();
  const appDb = openAppDb(':memory:');
  const sessions = new SessionStore(appDb);
  const cabinet = new CabinetStore(appDb, dom.drugDb);
  const searches: string[] = [];
  const linkFn = async (n: string) => ({ url: `https://www.drugs.com/${slugify(n)}.html`, verified: true });
  const base = { drugDb: dom.drugDb, resolver: dom.resolver, linkFn };
  const cfg = { reasoningEffort: 'off' as const, maxTurns: 6, queryTimeoutMs: over.queryTimeoutMs ?? 5000 };
  const ddi = createDdiAgent({ ...base, llm: f.llm, config: { agentModel: 'faux-1', ...cfg } });
  const webSearch = async (q: string) => {
    searches.push(q);
    return { text: over.searchResult ?? 'Kết quả tìm kiếm giả.', sources: [{ url: 'https://example.org/a', title: 'A' }] };
  };
  const chat = createChatAgent({
    ...base,
    llm: f.llm,
    sessions,
    webSearch,
    config: { chatModel: 'faux-1', ...cfg },
  });
  const extract = createExtractAgent({ llm: f.llm, model: 'faux-1', webSearch });
  const services = {
    log: pino({ level: 'silent' }),
    corsOrigins: ['http://localhost:5173'],
    drugDb: dom.drugDb,
    resolver: dom.resolver,
    sessions,
    cabinet,
    ddi,
    chat,
    extract,
  };
  const app = createApp(services);
  const request = (path: string, init?: RequestInit) => app.request(path, init) as Promise<Res>;
  const json = (path: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
    request(path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
  return { app, request, json, sessions, cabinet, searches, appDb, ...f, dom };
}
