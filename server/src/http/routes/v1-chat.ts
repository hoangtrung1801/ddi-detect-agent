import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { ChatRequestSchema } from '../../schemas/api.ts';
import type { AppServices } from '../services.ts';
import { HttpError, logRun, nowIso, readBody, runSink } from '../util.ts';

export function v1ChatRoutes(s: AppServices): Hono {
  const r = new Hono();

  r.post('/chat', async (c) => {
    const body = await readBody(c, ChatRequestSchema);
    const sessionId = body.session_id || randomUUID();
    const res = await s.chat.chat(body.question, sessionId, { sink: runSink(s.log), signal: c.req.raw.signal });
    logRun(s.log, 'chat', res.stats, res.ok ? 'ok' : res.error.code);
    if (!res.ok) {
      throw new HttpError(res.error.code === 'AGENT_TIMEOUT' ? 504 : 500, res.error.code, `Error processing chat: ${res.error.message}`);
    }
    return c.json({ answer: res.answer, session_id: sessionId, timestamp: nowIso() });
  });

  r.delete('/chat/:session_id', (c) => {
    const id = c.req.param('session_id');
    if (!s.sessions.delete(id)) return c.json({ detail: `Session ${id} not found` }, 404);
    return c.json({ message: `Session ${id} cleared`, success: true });
  });
  return r;
}
