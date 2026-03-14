import { useState } from 'react';
import { askAva } from '../../services/aiService';

export default function AvaAssistantPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  async function send() {
    if (!input.trim()) return;
    const response = await askAva(input, messages);
    setMessages([
      ...messages,
      { role: 'user', content: input },
      { role: 'assistant', content: response.content },
    ]);
    setInput('');
  }

  return (
    <div className="ava-panel">
      <h2>Ava Bridgestone</h2>
      <p>Advocate's Bridge</p>
      <div className="ava-messages">
        {messages.map((m, i) => (
          <div key={i} className={m.role}>{m.content}</div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask Ava anything..."
      />
      <button onClick={send}>Send</button>
    </div>
  );
}
