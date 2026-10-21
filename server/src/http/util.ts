import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { TSchema, Static } from 'typebox';
import { Value } from 'typebox/value';
import type { Logger } from 'pino';
import type { ProgressSink } from '../agent/progress.ts';
import type { RunStats } from '../agent/run.ts';
import type { ErrorCode } from '../schemas/api.ts';

export class HttpError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: ErrorCode;
  constructor(status: ContentfulStatusCode, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const STATUS_FOR_CODE: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION: 400,
  AGENT_TIMEOUT: 504,
  AGENT_NO_REPORT: 502,
  UPSTREAM_LLM: 502,
  NOT_FOUND: 404,
};

/** Parse and validate a JSON body. Throws HttpError(VALIDATION) with FastAPI-style detail on failure. */
export async function readBody<T extends TSchema>(c: Context, schema: T): Promise<Static<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HttpError(422, 'VALIDATION', 'Request body must be valid JSON');
  }
  if (!Value.Check(schema, body)) {
    const errs = [...Value.Errors(schema, body)];
    const detail = errs.map((e) => ({
      loc: ['body', ...e.instancePath.split('/').filter(Boolean)],
      msg: e.message,
      type: 'value_error',
    }));
    const err = new HttpError(422, 'VALIDATION', errs.map((e) => `${e.instancePath || '/'}: ${e.message}`).join('; '));
    (err as HttpError & { detail?: unknown }).detail = detail;
    throw err;
  }
  return body as Static<T>;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Logs one line per tool execution (with duration) and forwards events to an optional extra sink. */
export function runSink(log: Logger, extra?: ProgressSink): ProgressSink {
  return (e) => {
    if (e.type === 'tool_end') log.info({ tool: e.tool, ok: e.ok, ms: e.ms }, 'tool executed');
    extra?.(e);
  };
}

export function logRun(log: Logger, kind: string, stats: RunStats, outcome: string): void {
  log.info({ kind, outcome, ...stats }, 'agent run finished');
}
