import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type, type Static } from 'typebox';
import type { Llm } from '../llm/models.ts';
import { assertVisionModel } from '../llm/models.ts';
import type { WebSearchFn } from '../llm/web-search.ts';
import { EXTRACT_INSTRUCTIONS } from './prompts.ts';
import { runAgent, type ThinkingLevel } from './run.ts';
import { makeWebSearchTool } from './tools/web-search.ts';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// reasoning_steps comes first so the model writes its evidence before the conclusions.
const IngredientsParams = Type.Object({
  product_name: Type.Optional(
    Type.String({ description: 'The product (drug or supplement) as named on the packaging, brand and variant, e.g. "GH Creation EX+"' }),
  ),
  reasoning_steps: Type.Optional(
    Type.Array(Type.String(), { description: 'Step-by-step evidence from the image for each ingredient kept or discarded' }),
  ),
  active_ingredients: Type.Array(
    Type.Object({
      name: Type.String({ description: 'Ingredient (active, nutrient, amino acid, mineral, extract...), English generic name' }),
      strength: Type.Optional(Type.String({ description: 'Strength, e.g. 500 mg, or [unclear]' })),
    }),
    { description: 'Every ingredient of the product, in label order' },
  ),
});
type Ingredients = Static<typeof IngredientsParams>;

function makeSubmitTool(onSubmit: (i: Ingredients) => void): AgentTool<typeof IngredientsParams, Ingredients> {
  return {
    name: 'submit_ingredients',
    label: 'Submit ingredients',
    description:
      'Submit the product name and ALL its ingredients, from the label and any web search (empty list if none can be identified). One packaging image is one product.',
    parameters: IngredientsParams,
    execute: async (_id, params) => {
      onSubmit(params);
      return { content: [{ type: 'text', text: 'Ingredients accepted.' }], details: params, terminate: true };
    },
  };
}

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

/** A page the model found while searching, kept so the extracted ingredients can be traced back to it. */
export interface Evidence {
  url: string;
  title: string;
  query: string;
}

export interface ExtractAgentDeps {
  llm: Llm;
  model: string;
  /** Lets the model look up the full composition when the label does not show it. */
  webSearch?: WebSearchFn;
  reasoningEffort?: ThinkingLevel;
  maxTurns?: number;
  timeoutMs?: number;
}

export function createExtractAgent(deps: ExtractAgentDeps) {
  const model = deps.llm.getModel(deps.model);
  assertVisionModel(model);
  const timeoutMs = deps.timeoutMs ?? 90_000;
  return {
    /** Looks at the image, optionally searches the web, then submits. Returns ingredient names in label order, de-duplicated. */
    async extract(
      image: ImageData,
      signal?: AbortSignal,
    ): Promise<{
      /** The packaged product as printed on the label, when readable. */
      product: string | null;
      names: string[];
      ingredients: Ingredients['active_ingredients'];
      reasoning: string[];
      evidences: Evidence[];
    }> {
      let submitted: Ingredients | undefined;
      // Every source returned by a search in this run, first query wins per URL.
      const found = new Map<string, Evidence>();
      const webSearch: WebSearchFn | undefined = deps.webSearch
        ? async (query, sig) => {
            const r = await deps.webSearch!(query, sig);
            for (const src of r.sources) if (!found.has(src.url)) found.set(src.url, { url: src.url, title: src.title, query });
            return r;
          }
        : undefined;
      const out = await runAgent(
        {
          llm: deps.llm,
          modelId: deps.model,
          systemPrompt: EXTRACT_INSTRUCTIONS,
          tools: [...(webSearch ? [makeWebSearchTool(webSearch)] : []), makeSubmitTool((i) => (submitted = i))],
          thinking: deps.reasoningEffort ?? 'off',
          maxTurns: deps.maxTurns ?? 6,
          timeoutMs,
          ...(signal ? { signal } : {}),
        },
        'Extract every ingredient from this packaging image.',
        [{ type: 'image', data: image.data, mimeType: image.mimeType }],
      );
      if (!submitted) {
        if (out.stop === 'error') throw new Error(out.errorMessage ?? 'LLM call error');
        if (out.stop === 'timeout') throw new Error(`Extraction did not finish within ${timeoutMs} ms`);
        if (out.stop === 'aborted') throw new Error('Extraction aborted');
        throw new Error('Model did not return ingredients');
      }
      const seen = new Set<string>();
      const names: string[] = [];
      const ingredients: Ingredients['active_ingredients'] = [];
      for (const i of submitted.active_ingredients) {
        const n = i.name.trim();
        if (n && !/^\[?unclear\]?$/i.test(n) && !seen.has(n.toLowerCase())) {
          seen.add(n.toLowerCase());
          names.push(n);
          ingredients.push({ ...i, name: n });
        }
      }
      return {
        product: submitted.product_name?.trim() || null,
        names,
        ingredients,
        reasoning: submitted.reasoning_steps ?? [],
        evidences: [...found.values()],
      };
    },
  };
}

export type ExtractAgent = ReturnType<typeof createExtractAgent>;
