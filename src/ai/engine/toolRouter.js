import { tools } from '../tools';

export async function executeTool(call) {
  const tool = tools[call.name];
  if (!tool) return { content: 'Tool not found.' };
  return tool.execute(call.arguments || {});
}
