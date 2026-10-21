import { Hono } from 'hono';
import { AddDrugRequestSchema } from '../../schemas/api.ts';
import type { CabinetPair } from '../../store/cabinet.ts';
import type { AppServices } from '../services.ts';
import { nowIso, readBody } from '../util.ts';

const interactionText = (p: CabinetPair) => `Tương tác giữa ${p.a} và ${p.b}: ${p.condition}`;

export function v1CabinetRoutes(s: AppServices): Hono {
  const r = new Hono();
  const userOf = (c: { req: { query(k: string): string | undefined } }) => c.req.query('user_id') || 'admin';

  /** Resolve free text to the DB drug name (exact -> alias -> vector); null when not matched. */
  const dbNameOf = async (name: string): Promise<string | null> => (await s.resolver.resolve(name)).dbName;

  r.post('/add', async (c) => {
    const body = await readBody(c, AddDrugRequestSchema);
    const userId = body.user_id || 'admin';
    const input = body.drug_name.trim();
    if (!input) return c.json({ detail: 'Drug name cannot be empty' }, 400);
    const dbName = await dbNameOf(input);
    const base = { drug_name: dbName ?? input, user_id: userId, timestamp: nowIso() };
    if (!dbName) {
      return c.json({
        success: false,
        message: `Drug '${input}' could not be matched to the interaction database`,
        checking_interactions: false,
        ...base,
      });
    }
    const added = s.cabinet.add(userId, dbName, input);
    if (!added) {
      return c.json({ success: false, message: `Drug '${dbName}' already exists in medicine cabinet`, checking_interactions: false, ...base });
    }
    const n = added.existing.length;
    const found = added.pairs.filter((p) => p.status === 'interaction').length;
    return c.json({
      success: true,
      message: n
        ? `Drug '${dbName}' added successfully. Checked interactions with ${n} existing drug(s): ${found} interaction(s) found.`
        : `Drug '${dbName}' added successfully. No existing drugs to check interactions with.`,
      checking_interactions: n > 0,
      ...base,
    });
  });

  r.get('/list', (c) => {
    const userId = userOf(c);
    const drugs = s.cabinet.list(userId).map((name) => {
      const texts = s.cabinet
        .pairsFor(userId, name)
        .filter((p) => p.status === 'interaction')
        .map(interactionText);
      return { drug_name: name, interactions: texts.length ? texts.join(' | ') : null };
    });
    return c.json({ user_id: userId, drugs, count: drugs.length, timestamp: nowIso() });
  });

  r.delete('/remove/:drug_name', async (c) => {
    const userId = userOf(c);
    const name = c.req.param('drug_name');
    const dbName = await dbNameOf(name);
    if (!dbName || !s.cabinet.remove(userId, dbName)) {
      return c.json({ detail: `Drug '${name}' not found in medicine cabinet` }, 404);
    }
    return c.json({ success: true, message: `Drug '${name}' removed successfully`, drug_name: dbName, user_id: userId, timestamp: nowIso() });
  });

  r.get('/interactions/:drug_name', async (c) => {
    const userId = userOf(c);
    const name = c.req.param('drug_name');
    const dbName = await dbNameOf(name);
    if (!dbName || !s.cabinet.has(userId, dbName)) {
      return c.json({ detail: `Drug '${name}' not found in medicine cabinet` }, 404);
    }
    const interactions = s.cabinet
      .pairsFor(userId, dbName)
      .filter((p) => p.status === 'interaction')
      .map((p) => ({
        drug1: p.a,
        drug2: p.b,
        interaction: interactionText(p),
        has_interaction: true,
        severity: null,
        checked_at: p.checked_at,
      }));
    return c.json({ drug_name: dbName, user_id: userId, interactions, total_interactions: interactions.length, timestamp: nowIso() });
  });

  r.delete('/clear', (c) => {
    const userId = userOf(c);
    s.cabinet.clear(userId);
    return c.json({ success: true, message: `Medicine cabinet cleared for user '${userId}'`, user_id: userId, timestamp: nowIso() });
  });
  return r;
}
