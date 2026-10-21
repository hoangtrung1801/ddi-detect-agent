import { createModels, fauxProvider, type FauxResponseStep } from '@earendil-works/pi-ai';
import { wrap, type Llm } from '../../src/llm/models.ts';

export function makeFauxLlm(): { llm: Llm; setResponses: (r: FauxResponseStep[]) => void; appendResponses: (r: FauxResponseStep[]) => void; calls: () => number } {
  const faux = fauxProvider({ models: [{ id: 'faux-1', input: ['text', 'image'] }] });
  const models = createModels();
  models.setProvider(faux.provider);
  return {
    llm: wrap(models, faux.provider.id),
    setResponses: faux.setResponses,
    appendResponses: faux.appendResponses,
    calls: () => faux.state.callCount,
  };
}
