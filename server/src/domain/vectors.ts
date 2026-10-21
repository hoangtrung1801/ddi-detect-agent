import { readFileSync } from 'node:fs';
import type { VectorIndex } from './resolver.ts';

export function loadVectorIndex(vectorsPath: string, namesPath: string, dim = 384): VectorIndex {
  const names: string[] = JSON.parse(readFileSync(namesPath, 'utf8'));
  const buf = readFileSync(vectorsPath);
  const matrix = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  if (matrix.length !== names.length * dim) {
    throw new Error(`vector file size mismatch: ${matrix.length} floats for ${names.length} names x ${dim}`);
  }
  return { names, matrix: new Float32Array(matrix), dim };
}
