import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { validateToolCall, type AssistantMessage, type Tool, type ToolCall } from '@earendil-works/pi-ai';
import { Type, type Static } from 'typebox';
import type { Llm } from '../llm/models.ts';
import { assertVisionModel } from '../llm/models.ts';
import { EXTRACT_INSTRUCTIONS } from './prompts.ts';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// reasoning_steps comes first so the model writes its evidence before the conclusions.
const IngredientsParams = Type.Object({
  reasoning_steps: Type.Optional(
    Type.Array(Type.String(), { description: 'Step-by-step evidence from the image for each ingredient kept or discarded' }),
  ),
  active_ingredients: Type.Array(
    Type.Object({
      name: Type.String({ description: 'Active ingredient, English generic name' }),
      strength: Type.Optional(Type.String({ description: 'Strength, e.g. 500 mg, or [unclear]' })),
    }),
  ),
});
type Ingredients = Static<typeof IngredientsParams>;

const submitTool: Tool<typeof IngredientsParams> = {
  name: 'submit_ingredients',
  description: 'Submit the active ingredients found on the packaging (empty list if none are legible).',
  parameters: IngredientsParams,
};

export class ImageError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface ImageData {
  data: string; // base64
  mimeType: string;
}

/** Accepts a data URL or an http(s) URL. Blocks private addresses and redirects (SSRF), caps size, checks the type. */
export async function loadImageFromUrl(url: string, fetchFn: typeof fetch = fetch): Promise<ImageData> {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(url);
  if (m) {
    const mimeType = m[1]!.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) throw new ImageError(`Unsupported image type ${mimeType}`);
    const data = m[2]!.replace(/\s+/g, '');
    if (Math.floor((data.length * 3) / 4) > MAX_IMAGE_BYTES) throw new ImageError('Image too large (max 8 MB)', 413);
    return { data, mimeType };
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ImageError('image_url must be an http(s) URL or a base64 data URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ImageError('image_url must be an http(s) URL or a base64 data URL');
  await assertPublicHost(u.hostname);
  const res = await fetchFn(u, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  if (res.status >= 300 && res.status < 400) throw new ImageError('Redirects are not followed for image_url');
  if (!res.ok) throw new ImageError(`Could not fetch image (HTTP ${res.status})`);
  const mimeType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) throw new ImageError(`Unsupported image type ${mimeType || 'unknown'}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_IMAGE_BYTES) throw new ImageError('Image too large (max 8 MB)', 413);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new ImageError('Image too large (max 8 MB)', 413);
  return { data: buf.toString('base64'), mimeType };
}

export function imageFromBytes(bytes: Uint8Array, mimeType: string): ImageData {
  const t = mimeType.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(t)) throw new ImageError(`Unsupported image type ${mimeType || 'unknown'}`);
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new ImageError('Image too large (max 8 MB)', 413);
  if (bytes.byteLength === 0) throw new ImageError('Empty file');
  return { data: Buffer.from(bytes).toString('base64'), mimeType: t };
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
  }
  const p = ip.split('.').map(Number);
  const [a, b] = [p[0]!, p[1]!];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function assertPublicHost(host: string): Promise<void> {
  const h = host.replace(/^\[|\]$/g, '');
  const addrs = isIP(h) ? [h] : (await lookup(h, { all: true }).catch(() => [])).map((a) => a.address);
  if (addrs.length === 0) throw new ImageError('Could not resolve image host');
  if (addrs.some(isPrivateIp)) throw new ImageError('image_url must point to a public host');
}

export function createExtractAgent(deps: { llm: Llm; model: string; timeoutMs?: number }) {
  const model = deps.llm.getModel(deps.model);
  assertVisionModel(model);
  return {
    /** One model call (no loop). Returns ingredient names in label order, de-duplicated. */
    async extract(
      image: ImageData,
      signal?: AbortSignal,
    ): Promise<{ names: string[]; ingredients: Ingredients['active_ingredients']; reasoning: string[] }> {
      const timeout = AbortSignal.timeout(deps.timeoutMs ?? 60_000);
      const msg: AssistantMessage = await deps.llm.models.complete(
        model,
        {
          systemPrompt: EXTRACT_INSTRUCTIONS,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract the active ingredients from this packaging image.' },
                { type: 'image', data: image.data, mimeType: image.mimeType },
              ],
              timestamp: Date.now(),
            },
          ],
          tools: [submitTool],
        },
        { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
      );
      if (msg.stopReason === 'error' || msg.stopReason === 'aborted') {
        throw new Error(msg.errorMessage ?? `LLM call ${msg.stopReason}`);
      }
      const call = msg.content.find((c): c is ToolCall => c.type === 'toolCall' && c.name === 'submit_ingredients');
      if (!call) throw new Error('Model did not return ingredients');
      const args = validateToolCall([submitTool], call) as Ingredients;
      const seen = new Set<string>();
      const names: string[] = [];
      for (const i of args.active_ingredients) {
        const n = i.name.trim();
        if (n && !/^\[?unclear\]?$/i.test(n) && !seen.has(n.toLowerCase())) {
          seen.add(n.toLowerCase());
          names.push(n);
        }
      }
      return { names, ingredients: args.active_ingredients, reasoning: args.reasoning_steps ?? [] };
    },
  };
}

export type ExtractAgent = ReturnType<typeof createExtractAgent>;
