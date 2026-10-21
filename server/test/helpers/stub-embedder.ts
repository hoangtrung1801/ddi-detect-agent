import type { Embedder } from '../../src/domain/embedder.ts';
import type { VectorIndex } from '../../src/domain/resolver.ts';

const DIM = 128;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic char-trigram hashing embedder: similar spellings give high cosine. No network, no model. */
export function stubEmbedder(): Embedder {
  return {
    dim: DIM,
    async embed(texts: string[]) {
      return texts.map((t) => {
        const v = new Float32Array(DIM);
        const s = `  ${t.toLowerCase().trim()}  `;
        for (let i = 0; i + 3 <= s.length; i++) v[hash(s.slice(i, i + 3)) % DIM]! += 1;
        let n = 0;
        for (const x of v) n += x * x;
        n = Math.sqrt(n) || 1;
        return v.map((x) => x / n);
      });
    },
  };
}

export async function stubVectorIndex(names: string[], embedder = stubEmbedder()): Promise<VectorIndex> {
  const vecs = await embedder.embed(names);
  const matrix = new Float32Array(names.length * embedder.dim);
  vecs.forEach((v, i) => matrix.set(v, i * embedder.dim));
  return { names, matrix, dim: embedder.dim };
}
