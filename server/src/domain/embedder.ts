// Sentence embedder (all-MiniLM-L6-v2 via transformers.js). Injected into the resolver so tests never download models.
export interface Embedder {
  dim: number;
  /** Returns L2-normalised vectors, one per input. */
  embed(texts: string[]): Promise<Float32Array[]>;
}

export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM = 384;

export async function createTransformersEmbedder(): Promise<Embedder> {
  const { pipeline } = await import('@huggingface/transformers');
  const extractor: any = await pipeline('feature-extraction', EMBED_MODEL, { dtype: 'fp32' });
  return {
    dim: EMBED_DIM,
    async embed(texts: string[]): Promise<Float32Array[]> {
      const out: Float32Array[] = [];
      const batch = 64;
      for (let i = 0; i < texts.length; i += batch) {
        const slice = texts.slice(i, i + batch);
        const t = await extractor(slice, { pooling: 'mean', normalize: true });
        const data = t.data as Float32Array;
        for (let j = 0; j < slice.length; j++) {
          out.push(Float32Array.from(data.subarray(j * EMBED_DIM, (j + 1) * EMBED_DIM)));
        }
      }
      return out;
    },
  };
}
