import { describe, expect, it } from 'vitest';
import { ingredientVariants } from '../../src/domain/resolver.ts';
import { makeDomain } from '../helpers/domain.ts';

describe('Resolver', () => {
  it('exact match on input, case/space-insensitive', async () => {
    const { resolver } = await makeDomain();
    const r = await resolver.resolve('  warFARIN ');
    expect(r).toMatchObject({ dbName: 'Warfarin', method: 'exact', confidence: 1 });
  });

  it('exact match on the generic guess when the brand is unknown', async () => {
    const { resolver } = await makeDomain();
    const r = await resolver.resolve('Brufenzo', 'ibuprofen');
    expect(r).toMatchObject({ dbName: 'Ibuprofen', method: 'exact', input: 'Brufenzo', generic: 'ibuprofen' });
  });

  it('alias table maps brands and synonyms to DB names', async () => {
    const { resolver } = await makeDomain();
    expect(await resolver.resolve('Tylenol')).toMatchObject({ dbName: 'Acetaminophen', method: 'alias' });
    expect(await resolver.resolve('Paracetamol 500mg')).toMatchObject({ dbName: 'Acetaminophen', method: 'alias' });
    expect(await resolver.resolve('Aspirin')).toMatchObject({ dbName: 'Acetylsalicylic acid', method: 'alias' });
    expect(await resolver.resolve('x', 'Coumadin')).toMatchObject({ dbName: 'Warfarin', method: 'alias' });
  });

  it('alias whose target is not in the DB falls through (does not invent a name)', async () => {
    const { resolver } = await makeDomain({ resolveMin: 0.99 });
    const r = await resolver.resolve('Lipitor');
    expect(r.dbName).toBeNull();
  });

  it('strips dose text and brackets before matching', async () => {
    const { resolver } = await makeDomain();
    expect(await resolver.resolve('Metformin 500 mg tablets')).toMatchObject({ dbName: 'Metformin', method: 'exact' });
  });

  it('vector match for misspellings, with alternatives', async () => {
    const { resolver } = await makeDomain({ resolveMin: 0.6 });
    const r = await resolver.resolve('Ibuprofin');
    expect(r.method).toBe('vector');
    expect(r.dbName).toBe('Ibuprofen');
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    expect(r.alternatives).toHaveLength(2);
  });

  it('below threshold: dbName is null, method none, alternatives kept', async () => {
    const { resolver } = await makeDomain({ resolveMin: 0.8 });
    const r = await resolver.resolve('Zzyzxtol');
    expect(r.dbName).toBeNull();
    expect(r.method).toBe('none');
    expect(r.alternatives).toHaveLength(3);
    expect(r.confidence).toBeLessThan(0.8);
  });

  it('returns independent copies from the cache', async () => {
    const { resolver } = await makeDomain();
    const a = await resolver.resolve('warfarin');
    a.dbName = 'mutated';
    expect((await resolver.resolve('warfarin')).dbName).toBe('Warfarin');
  });
});

describe('ingredientVariants', () => {
  it('puts the substance hidden in label phrasing first and the raw text last', () => {
    expect(ingredientVariants('Calcium (from calcium carbonate)')).toEqual(['calcium carbonate', 'Calcium', 'Calcium (from calcium carbonate)']);
    expect(ingredientVariants('Calcium carbonate from oyster shells')).toEqual(['Calcium carbonate', 'Calcium carbonate from oyster shells']);
    expect(ingredientVariants('Ibuprofen')).toEqual(['Ibuprofen']);
    expect(ingredientVariants('Vitamin D3 (as cholecalciferol)')[0]).toBe('cholecalciferol');
  });
});
