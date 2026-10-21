import type { Logger } from 'pino';
import { createChatAgent } from './agent/chat-agent.ts';
import { createDdiAgent } from './agent/ddi-agent.ts';
import { createExtractAgent } from './agent/extract-agent.ts';
import type { Config } from './config.ts';
import { openDomain } from './domain/open.ts';
import { link } from './domain/links.ts';
import type { AppServices } from './http/services.ts';
import { createOpenAiLlm } from './llm/models.ts';
import { createOpenAiWebSearch } from './llm/web-search.ts';
import { openAppDb } from './store/app-db.ts';
import { CabinetStore } from './store/cabinet.ts';
import { SqlCache } from './store/cache.ts';
import { SessionStore } from './store/sessions.ts';

/** Wire real dependencies. Fails fast on missing data files or API key. */
export async function createServices(cfg: Config, log: Logger): Promise<AppServices & { close(): void }> {
  if (!cfg.openaiApiKey) throw new Error('OPENAI_API_KEY is not set');
  const { drugDb, resolver } = await openDomain(cfg);
  const appDb = openAppDb(cfg.appDbPath);
  const sessions = new SessionStore(appDb);
  const cabinet = new CabinetStore(appDb, drugDb);
  const cache = new SqlCache(appDb);
  cache.purgeExpired();
  const linkCache = cache.linkCache();
  const linkFn = (name: string) => link(name, { cache: linkCache });

  const llm = createOpenAiLlm();
  const reasoning = cfg.reasoningEffort;
  const deps = { drugDb, resolver, linkFn };
  const ddi = createDdiAgent({
    ...deps,
    llm,
    config: { agentModel: cfg.agentModel, reasoningEffort: reasoning, maxTurns: cfg.maxTurns, queryTimeoutMs: cfg.queryTimeoutMs },
  });
  const chat = createChatAgent({
    ...deps,
    llm,
    sessions,
    webSearch: createOpenAiWebSearch({ apiKey: cfg.openaiApiKey, model: cfg.webSearchModel }),
    config: { chatModel: cfg.chatModel, reasoningEffort: reasoning, maxTurns: cfg.maxTurns, queryTimeoutMs: cfg.queryTimeoutMs },
  });
  const extract = createExtractAgent({ llm, model: cfg.extractModel });
  return {
    log,
    corsOrigins: cfg.corsOrigins,
    drugDb,
    resolver,
    sessions,
    cabinet,
    ddi,
    chat,
    extract,
    close() {
      appDb.close();
      drugDb.close();
    },
  };
}
