import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ImageError, MAX_IMAGE_BYTES, imageFromBytes, loadImageFromUrl, type ImageData } from '../../agent/extract-agent.ts';
import { DrugNamesFromImageRequestSchema } from '../../schemas/api.ts';
import type { AppServices } from '../services.ts';
import { nowIso, readBody } from '../util.ts';

export function v1ExtractRoutes(s: AppServices): Hono {
  const r = new Hono();

  const run = async (load: () => Promise<ImageData>, signal: AbortSignal) => {
    try {
      const image = await load();
      const { product, names, ingredients, evidences } = await s.extract.extract(image, signal);
      // `result` stays the flat ingredient-name list for v1 clients; `product_name` + `ingredients` describe the one product on the image.
      return { ok: true as const, body: { result: names, product_name: product, ingredients, evidences, timestamp: nowIso() } };
    } catch (e) {
      if (e instanceof ImageError) return { ok: false as const, status: e.status as 400 | 413, detail: e.message };
      s.log.error({ err: e instanceof Error ? e.message : String(e) }, 'drug name extraction failed');
      return { ok: false as const, status: 500 as const, detail: `Error processing image: ${e instanceof Error ? e.message : String(e)}` };
    }
  };

  r.post('/drug-name-extract', async (c) => {
    const body = await readBody(c, DrugNamesFromImageRequestSchema);
    const out = await run(() => loadImageFromUrl(body.image_url), c.req.raw.signal);
    return out.ok ? c.json(out.body) : c.json({ detail: out.detail }, out.status);
  });

  r.post(
    '/drug-name-extract/upload',
    bodyLimit({
      maxSize: MAX_IMAGE_BYTES + 1024 * 1024,
      onError: (c) => c.json({ detail: 'Image too large (max 8 MB)' }, 413),
    }),
    async (c) => {
      let form: Record<string, string | File | (string | File)[]>;
      try {
        form = await c.req.parseBody();
      } catch {
        return c.json({ detail: 'Expected multipart/form-data with a "file" field' }, 400);
      }
      const file = form['file'];
      if (!(file instanceof File)) return c.json({ detail: 'Missing "file" upload field' }, 400);
      const out = await run(async () => imageFromBytes(new Uint8Array(await file.arrayBuffer()), file.type), c.req.raw.signal);
      return out.ok ? c.json(out.body) : c.json({ detail: out.detail }, out.status);
    },
  );
  return r;
}
