// M0 spike: pi Agent + OpenAI + one terminating tool returning structured details.
import { Agent, type AgentTool } from '@earendil-works/pi-agent-core';
import { createModels, Type } from '@earendil-works/pi-ai';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { loadEnvFiles } from '../src/env.ts';

loadEnvFiles();
const models = createModels();
models.setProvider(openaiProvider());
const model = models.getModel('openai', process.env.AGENT_MODEL ?? 'gpt-5.4-mini')!;
console.log('model', model.id, 'input', model.input, 'reasoning', model.reasoning);
const extract = models.getModel('openai', process.env.EXTRACT_MODEL ?? 'gpt-5.4-mini')!;
console.log('extract model supports image:', extract.input.includes('image'));

const submit: AgentTool<ReturnType<typeof schema>> = {
  name: 'submit_greeting',
  label: 'Submit greeting',
  description: 'Submit the final structured greeting. Call exactly once when done.',
  parameters: schema(),
  execute: async (_id, params) => ({
    content: [{ type: 'text', text: 'ok' }],
    details: { greeting: params.greeting, words: params.greeting.split(/\s+/).length },
    terminate: true,
  }),
};
function schema() {
  return Type.Object({ greeting: Type.String({ description: 'Greeting text in Vietnamese' }) });
}

const agent = new Agent({
  initialState: {
    systemPrompt: 'You greet users. Always finish by calling submit_greeting.',
    model,
    tools: [submit],
  },
  streamFn: models.streamSimple.bind(models),
  toolExecution: 'parallel',
});
let turns = 0;
agent.subscribe((e) => {
  if (e.type === 'turn_start') turns++;
  if (e.type === 'tool_execution_end') console.log('tool_end', e.toolName, JSON.stringify(e.result.details));
});
const t0 = Date.now();
await agent.prompt('Chào hỏi một người dùng tên Lan.');
await agent.waitForIdle();
const last = agent.state.messages.at(-1);
console.log('turns', turns, 'ms', Date.now() - t0, 'last role', last?.role, 'error', agent.state.errorMessage);
const usage = agent.state.messages.filter((m) => m.role === 'assistant').map((m: any) => m.usage.totalTokens);
console.log('tokens per assistant msg', usage);
const tr: any = agent.state.messages.find((m) => m.role === 'toolResult');
console.log('toolResult details', JSON.stringify(tr?.details));
