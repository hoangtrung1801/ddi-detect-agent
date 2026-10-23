import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { V2ChatRequestSchema, V2InteractionsRequestSchema } from '../../schemas/api.ts';
import type { AppServices } from '../services.ts';
import { v2GraphRoutes } from './v2-graph.ts';
import { HttpError, STATUS_FOR_CODE, logRun, readBody, runSink } from '../util.ts';

export function v2Routes(s: AppServices): Hono {
  const r = new Hono();
  r.route('/', v2GraphRoutes(s));

  r.post('/interactions', async (c) => {
    const body = await readBody(c, V2InteractionsRequestSchema);
    const input = 'drugs' in body ? { drugs: body.drugs } : { text: body.text };
    const res = await s.ddi.run(input, { sink: runSink(s.log), signal: c.req.raw.signal });
    logRun(s.log, 'v2.interactions', res.stats, res.ok ? 'ok' : res.error.code);
    if (!res.ok) throw new HttpError(STATUS_FOR_CODE[res.error.code], res.error.code, res.error.message);
    return c.json(res.report);
  });

  r.post('/interactions/stream', async (c) => {
    const body = await readBody(c, V2InteractionsRequestSchema);
    const input = 'drugs' in body ? { drugs: body.drugs } : { text: body.text };
    return streamSSE(c, async (stream) => {
      const ac = new AbortController();
      stream.onAbort(() => ac.abort());
      let chain = Promise.resolve();
      const send = (event: string, data: unknown) => {
        chain = chain.then(() => stream.writeSSE({ event, data: JSON.stringify(data) })).catch(() => {});
      };
      const res = await s.ddi.run(input, {
        sink: runSink(s.log, (e) => send('progress', e)),
        signal: ac.signal,
      });
      logRun(s.log, 'v2.interactions.stream', res.stats, res.ok ? 'ok' : res.error.code);
      if (res.ok) send('report', res.report);
      else send('error', { error: { code: res.error.code, message: res.error.message } });
      await chain;
    });
  });

  r.post('/chat', async (c) => {
    const body = await readBody(c, V2ChatRequestSchema);
    const sessionId = body.session_id || randomUUID();
    const res = await s.chat.chat(body.question, sessionId, { sink: runSink(s.log), signal: c.req.raw.signal });
    logRun(s.log, 'v2.chat', res.stats, res.ok ? 'ok' : res.error.code);
    if (!res.ok) throw new HttpError(STATUS_FOR_CODE[res.error.code], res.error.code, res.error.message);
    return c.json({ answer: res.answer, session_id: sessionId });
  });

  r.get('/sessions/:id', (c) => {
    const id = c.req.param('id');
    const info = s.sessions.info(id);
    if (!info) throw new HttpError(404, 'NOT_FOUND', `Session ${id} not found`);
    const messages = s.sessions
      .getMessages(id)
      .map((m) => {
        const msg = m as { role: string; content: unknown };
        if (msg.role !== 'user' && msg.role !== 'assistant') return null;
        const text =
          typeof msg.content === 'string'
            ? msg.content
            : (msg.content as { type: string; text?: string }[])
                .filter((p) => p.type === 'text')
                .map((p) => p.text ?? '')
                .join('');
        return text.trim() ? { role: msg.role, text } : null;
      })
      .filter((m): m is { role: string; text: string } => m !== null);
    return c.json({ ...info, messages });
  });
  return r;
}
