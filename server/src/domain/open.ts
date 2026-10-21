import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import type { Config } from '../config.ts';
import { DrugDb } from './drug-db.ts';
import { createTransformersEmbedder, type Embedder } from './embedder.ts';
import { Resolver } from './resolver.ts';
import { loadVectorIndex } from './vectors.ts';

export interface Domain {
  drugDb: DrugDb;
  resolver: Resolver;
  embedder: Embedder;
}

/** Open the generated data files (run `pnpm data:build` first) and warm the embedder. */
export async function openDomain(cfg: Pick<Config, 'ddiDbPath' | 'vectorsPath' | 'namesPath' | 'resolveMin'>): Promise<Domain> {
  for (const p of [cfg.ddiDbPath, cfg.vectorsPath, cfg.namesPath]) {
    if (!existsSync(p)) throw new Error(`Missing data file ${p}. Run "pnpm data:build" first.`);
  }
  const drugDb = new DrugDb(new Database(cfg.ddiDbPath, { readonly: true, fileMustExist: true }));
  const vectors = loadVectorIndex(cfg.vectorsPath, cfg.namesPath);
  const embedder = await createTransformersEmbedder();
  await embedder.embed(['warmup']);
  const resolver = new Resolver({ drugDb, vectors, embedder, resolveMin: cfg.resolveMin });
  return { drugDb, resolver, embedder };
}
