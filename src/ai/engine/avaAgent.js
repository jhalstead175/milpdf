import { runModel } from '../providers/providerInterface';
import { executeTool } from './toolRouter';
import { avaSystemPrompt } from '../prompts/avaSystemPrompt';

export async function runAvaAgent(message, history = []) {
  const messages = [
    { role: 'system', content: avaSystemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  const response = await runModel({ provider: 'openai', messages });

  if (response.tool_calls?.length) {
    return executeTool(response.tool_calls[0]);
  }

  return { content: response.choices?.[0]?.message?.content || '' };
}
