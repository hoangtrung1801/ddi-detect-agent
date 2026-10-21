import type { Logger } from 'pino';
import type { ChatAgent } from '../agent/chat-agent.ts';
import type { DdiAgent } from '../agent/ddi-agent.ts';
import type { ExtractAgent } from '../agent/extract-agent.ts';
import type { DrugDb } from '../domain/drug-db.ts';
import type { Resolver } from '../domain/resolver.ts';
import type { CabinetStore } from '../store/cabinet.ts';
import type { SessionStore } from '../store/sessions.ts';

/** Everything the HTTP layer needs. Tests build this with a scripted LLM and the mini fixture. */
export interface AppServices {
  log: Logger;
  corsOrigins: string[];
  drugDb: DrugDb;
  resolver: Resolver;
  sessions: SessionStore;
  cabinet: CabinetStore;
  ddi: Pick<DdiAgent, 'run'>;
  chat: Pick<ChatAgent, 'chat'>;
  extract: Pick<ExtractAgent, 'extract'>;
}
