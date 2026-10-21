import { readFileSync } from 'node:fs';

/** Minimal .npy reader for little-endian float32 / float64 C-order 2-D arrays. */
export function readNpy(path: string): { shape: number[]; data: Float32Array } {
  const buf = readFileSync(path);
  if (buf.toString('latin1', 1, 6) !== 'NUMPY') throw new Error('not an npy file');
  const major = buf[6]!;
  const headerLen = major === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
  const start = major === 1 ? 10 : 12;
  const header = buf.toString('latin1', start, start + headerLen);
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1];
  const shapeStr = /'shape':\s*\(([^)]*)\)/.exec(header)?.[1] ?? '';
  const shape = shapeStr.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  if (/'fortran_order':\s*True/.test(header)) throw new Error('fortran order unsupported');
  const off = start + headerLen;
  const n = shape.reduce((a, b) => a * b, 1);
  const out = new Float32Array(n);
  if (descr === '<f4') {
    for (let i = 0; i < n; i++) out[i] = buf.readFloatLE(off + i * 4);
  } else if (descr === '<f8') {
    for (let i = 0; i < n; i++) out[i] = buf.readDoubleLE(off + i * 8);
  } else throw new Error(`unsupported dtype ${descr}`);
  return { shape, data: out };
}
