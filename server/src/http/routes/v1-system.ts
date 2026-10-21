import { Hono } from 'hono';
import type { AppServices } from '../services.ts';
import { nowIso } from '../util.ts';

export function v1SystemRoutes(s: AppServices): Hono {
  const r = new Hono();
  r.get('/health', (c) => c.json({ status: 'healthy', agent_loaded: true, timestamp: nowIso() }));
  r.get('/', (c) =>
    c.json({ name: 'Drug Interaction Agent API', version: '2.0.0', docs: '/docs', health: '/health', stats: '/stats' }),
  );
  r.get('/stats', (c) => {
    const st = s.drugDb.stats();
    return c.json({ total_drugs: st.drugs, total_interactions: st.interactions, active_sessions: s.sessions.count() });
  });
  return r;
}
