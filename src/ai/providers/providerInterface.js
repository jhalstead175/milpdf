export async function runModel({ provider, messages }) {
  return {
    provider,
    choices: [{ message: { content: 'Ava response stub.' } }],
    tool_calls: null,
    messages,
  };
}
