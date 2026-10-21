import type { StreamFn } from '@earendil-works/pi-agent-core';
import { createModels, type Api, type Model, type MutableModels } from '@earendil-works/pi-ai';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';

export interface Llm {
  models: MutableModels;
  streamFn: StreamFn;
  getModel(id: string): Model<Api>;
}

/** All pi-ai usage goes through here and agent/run.ts. */
export function createOpenAiLlm(): Llm {
  const models = createModels();
  models.setProvider(openaiProvider());
  return wrap(models, 'openai');
}

export function wrap(models: MutableModels, provider: string): Llm {
  return {
    models,
    streamFn: models.streamSimple.bind(models) as StreamFn,
    getModel(id: string) {
      const m = models.getModel(provider, id);
      if (!m) throw new Error(`Unknown model "${id}" for provider "${provider}"`);
      return m;
    },
  };
}

export function assertVisionModel(model: Model<Api>): void {
  if (!model.input.includes('image')) throw new Error(`Model ${model.id} does not accept image input (EXTRACT_MODEL)`);
}
