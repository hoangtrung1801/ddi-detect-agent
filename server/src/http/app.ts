import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppServices } from './services.ts';
import { v1CabinetRoutes } from './routes/v1-cabinet.ts';
import { v1ChatRoutes } from './routes/v1-chat.ts';
import { v1ExtractRoutes } from './routes/v1-extract.ts';
import { v1QueryRoutes } from './routes/v1-query.ts';
import { v1SystemRoutes } from './routes/v1-system.ts';
import { v2Routes } from './routes/v2.ts';
import { HttpError } from './util.ts';

export function createApp(s: AppServices): Hono {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origin) => (s.corsOrigins.includes('*') || s.corsOrigins.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposeHeaders: ['X-Request-Id'],
    }),
  );

  app.use('*', async (c, next) => {
    const id = c.req.header('x-request-id') || randomUUID();
    c.header('x-request-id', id);
    const t0 = performance.now();
    await next();
    s.log.info({ reqId: id, method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - t0) }, 'request');
  });

  app.route('/', v1SystemRoutes(s));
  app.route('/', v1QueryRoutes(s));
  app.route('/', v1ChatRoutes(s));
  app.route('/', v1ExtractRoutes(s));
  app.route('/medicine-cabinet', v1CabinetRoutes(s));
  app.route('/v2', v2Routes(s));

  app.notFound((c) =>
    c.req.path.startsWith('/v2')
      ? c.json({ error: { code: 'NOT_FOUND', message: 'Not Found' } }, 404)
      : c.json({ detail: 'Not Found' }, 404),
  );

  app.onError((err, c) => {
    const isV2 = c.req.path.startsWith('/v2');
    if (err instanceof HttpError) {
      if (isV2) return c.json({ error: { code: err.code, message: err.message } }, err.status === 422 ? 400 : err.status);
      const detail = (err as HttpError & { detail?: unknown }).detail ?? err.message;
      return c.json({ detail }, err.status);
    }
    s.log.error({ err: err instanceof Error ? err.message : String(err), path: c.req.path }, 'unhandled error');
    return isV2
      ? c.json({ error: { code: 'UPSTREAM_LLM', message: 'Internal error' } }, 500)
      : c.json({ detail: `Internal error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  });

  return app;
}
