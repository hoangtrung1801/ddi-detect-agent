import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { SEED_ALIASES } from '../../src/domain/aliases.ts';
import { DrugDb } from '../../src/domain/drug-db.ts';

const dbPath = new URL('../../data/ddi.sqlite', import.meta.url).pathname;

describe('alias seed table', () => {
  it.skipIf(!existsSync(dbPath))('every alias target exists in the real interaction DB (run pnpm data:build)', () => {
    const db = new DrugDb(new Database(dbPath, { readonly: true }));
    const missing = Object.keys(SEED_ALIASES).filter((t) => !db.getDrug(t));
    expect(missing).toEqual([]);
  });
  it('has no alias mapped to two targets', () => {
    const seen = new Map<string, string>();
    for (const [t, as] of Object.entries(SEED_ALIASES)) for (const a of as) {
      expect(seen.get(a), a).toBeUndefined();
      seen.set(a, t);
    }
  });
});
