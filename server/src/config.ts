import { fileURLToPath } from 'node:url';
import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

const ConfigSchema = Type.Object({
  openaiApiKey: Type.String(),
  agentModel: Type.String({ minLength: 1 }),
  chatModel: Type.String({ minLength: 1 }),
  extractModel: Type.String({ minLength: 1 }),
  webSearchModel: Type.String({ minLength: 1 }),
  reasoningEffort: Type.Union([
    Type.Literal('off'),
    Type.Literal('minimal'),
    Type.Literal('low'),
    Type.Literal('medium'),
    Type.Literal('high'),
  ]),
  port: Type.Integer({ minimum: 1, maximum: 65535 }),
  corsOrigins: Type.Array(Type.String()),
  ddiDbPath: Type.String(),
  vectorsPath: Type.String(),
  namesPath: Type.String(),
  appDbPath: Type.String(),
  resolveMin: Type.Number({ minimum: 0, maximum: 1 }),
  maxTurns: Type.Integer({ minimum: 1, maximum: 50 }),
  queryTimeoutMs: Type.Integer({ minimum: 1000 }),
  logLevel: Type.Union([
    Type.Literal('fatal'),
    Type.Literal('error'),
    Type.Literal('warn'),
    Type.Literal('info'),
    Type.Literal('debug'),
    Type.Literal('silent'),
  ]),
});
export type Config = Static<typeof ConfigSchema>;

const serverRoot = fileURLToPath(new URL('..', import.meta.url));
const abs = (p: string) => (p.startsWith('/') ? p : `${serverRoot}${p}`);

/** Parse and validate env. Throws with a readable message listing every invalid key. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const num = (v: string | undefined, d: number) => (v === undefined || v === '' ? d : Number(v));
  const cfg = {
    openaiApiKey: env.OPENAI_API_KEY ?? '',
    agentModel: env.AGENT_MODEL ?? 'gpt-6-luna',
    chatModel: env.CHAT_MODEL ?? 'gpt-6-luna',
    extractModel: env.EXTRACT_MODEL ?? 'gpt-6-luna',
    webSearchModel: env.WEB_SEARCH_MODEL ?? 'gpt-6-luna',
    reasoningEffort: env.REASONING_EFFORT ?? 'low',
    port: num(env.PORT, 8000),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    ddiDbPath: abs(env.DDI_DB_PATH ?? 'data/ddi.sqlite'),
    vectorsPath: abs(env.VECTORS_PATH ?? 'data/drug-vectors.f32'),
    namesPath: abs(env.NAMES_PATH ?? 'data/drug-names.json'),
    appDbPath: env.APP_DB_PATH === ':memory:' ? ':memory:' : abs(env.APP_DB_PATH ?? 'data/app.sqlite'),
    resolveMin: num(env.RESOLVE_MIN, 0.8),
    maxTurns: num(env.MAX_TURNS, 6),
    queryTimeoutMs: num(env.QUERY_TIMEOUT_MS, 60000),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
  if (!Value.Check(ConfigSchema, cfg)) {
    const errs = [...Value.Errors(ConfigSchema, cfg)].map((e) => `${e.instancePath || '/'}: ${e.message}`);
    throw new Error(`Invalid configuration:\n  ${errs.join('\n  ')}`);
  }
  if (cfg.openaiApiKey === '' && env.NODE_ENV !== 'test') {
    // Not fatal for the config object (tests, offline tools); the LLM layer fails fast when it is used.
  }
  return cfg;
}
