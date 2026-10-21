import { describe, expect, it } from 'vitest';
import { makeDomain } from '../helpers/domain.ts';

describe('build + DrugDb', () => {
  it('builds drugs and undirected edges, duplicate pair: last row wins', async () => {
    const { drugDb, stats } = await makeDomain();
    expect(stats.rows).toBe(9);
    expect(stats.drugs).toBe(10);
    // 9 rows, one duplicate Warfarin/Ibuprofen pair
    expect(stats.interactions).toBe(8);
    expect(drugDb.stats()).toEqual({ drugs: 10, interactions: 8 });
    const w = drugDb.getDrug('  WARFARIN ')!;
    const i = drugDb.getDrug('ibuprofen')!;
    const rec = drugDb.lookupPair(w, i)!;
    expect(rec.condition).toMatch(/risk or severity of bleeding/);
    expect(rec.firstNamed).toBe('Warfarin');
    // undirected
    expect(drugDb.lookupPair(i, w)).toEqual(rec);
  });

  it('keeps quoted commas and the directional first-named drug', async () => {
    const { drugDb } = await makeDomain();
    const rec = drugDb.lookupPair(drugDb.getDrug('warfarin')!, drugDb.getDrug('acetaminophen')!)!;
    expect(rec.condition).toBe('Acetaminophen may increase the anticoagulant activities of Warfarin, leading to bleeding.');
    expect(rec.firstNamed).toBe('Acetaminophen');
  });

  it('returns null for pairs with no record, same drug, and unknown drugs', async () => {
    const { drugDb } = await makeDomain();
    expect(drugDb.lookupPair(drugDb.getDrug('digoxin')!, drugDb.getDrug('cetirizine')!)).toBeNull();
    const d = drugDb.getDrug('digoxin')!;
    expect(drugDb.lookupPair(d, d)).toBeNull();
    expect(drugDb.getDrug('nonexistium')).toBeUndefined();
  });
});
