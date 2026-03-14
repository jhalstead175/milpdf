import { runAvaAgent } from '../ai/engine/avaAgent';

export async function askAva(message, history = []) {
  return runAvaAgent(message, history);
}
