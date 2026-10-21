// M0 parity: transformers.js embeddings vs the Python-generated drug_embeddings_embeddings.npy.
// Method: for 50 evenly-spaced drug names (lower-cased, as the resolver will query), embed in JS, take top-1
// cosine against the Python matrix and check it is that same drug; also report cosine to its own Python vector.
import { readFileSync } from 'node:fs';
import { createTransformersEmbedder } from '../src/domain/embedder.ts';
import { readNpy } from '../src/util/npy.ts';

const root = new URL('../../', import.meta.url).pathname;
const names: string[] = JSON.parse(readFileSync(root + 'drug_embeddings_mapping.json', 'utf8')).drug_names;
const { shape, data } = readNpy(root + 'drug_embeddings_embeddings.npy');
const [n, d] = shape as [number, number];
const mat = new Float32Array(data);
for (let i = 0; i < n; i++) {
  let s = 0;
  for (let k = 0; k < d; k++) s += mat[i * d + k]! ** 2;
  s = Math.sqrt(s);
  for (let k = 0; k < d; k++) mat[i * d + k]! /= s;
}
const emb = await createTransformersEmbedder();
const idx = Array.from({ length: 50 }, (_, i) => Math.floor((i * n) / 50));
const vecs = await emb.embed(idx.map((i) => names[i]!.toLowerCase()));
let ok = 0;
let minSelf = 1;
vecs.forEach((v, j) => {
  let best = -1, bi = -1, self = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < d; k++) s += v[k]! * mat[i * d + k]!;
    if (i === idx[j]) self = s;
    if (s > best) { best = s; bi = i; }
  }
  if (bi === idx[j]) ok++; else console.log('MISMATCH', names[idx[j]!], '->', names[bi], best.toFixed(4), 'self', self.toFixed(4));
  minSelf = Math.min(minSelf, self);
});
console.log(`parity top-1: ${ok}/50, min cosine to own Python vector: ${minSelf.toFixed(5)}`);
if (ok < 49) process.exit(1);
