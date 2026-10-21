import { Hono } from 'hono';
import { QueryRequestSchema } from '../../schemas/api.ts';
import { DEFAULT_SESSION } from '../../store/sessions.ts';
import { reportToQueryResponse } from '../mappers/v1.ts';
import type { AppServices } from '../services.ts';
import { HttpError, logRun, readBody, runSink } from '../util.ts';

export function v1QueryRoutes(s: AppServices): Hono {
  const r = new Hono();

  r.post('/query', async (c) => {
    const body = await readBody(c, QueryRequestSchema);
    const res = await s.ddi.run({ text: body.question }, { sink: runSink(s.log), signal: c.req.raw.signal });
    logRun(s.log, 'query', res.stats, res.ok ? 'ok' : res.error.code);
    if (!res.ok) {
      throw new HttpError(res.error.code === 'AGENT_TIMEOUT' ? 504 : 500, res.error.code, `Error processing query: ${res.error.message}`);
    }
    // Legacy clients call /chat without having sent a session id to /query: keep the anonymous slot as a fallback.
    s.sessions.setReport(DEFAULT_SESSION, res.report);
    if (body.session_id) s.sessions.setReport(body.session_id, res.report);
    return c.json(reportToQueryResponse(res.report));
  });

  // The old endpoint always failed (it called a method that does not exist).
  r.post('/query-translate', (c) => c.json({ detail: '/query-translate has been removed; /query already answers in Vietnamese' }, 410));
  return r;
}
