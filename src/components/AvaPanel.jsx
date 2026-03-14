import { useState } from 'react';

export default function AvaPanel({ onAsk }) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const result = await onAsk(question.trim());
      setResponse(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel ava-panel">
      <div className="panel-header">Ava (Legal AI)</div>
      <div className="panel-body">
        <div className="field">
          <label>Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about timelines, contradictions, summaries, or motions..."
          />
        </div>
        <button className="btn-primary" onClick={handleAsk} disabled={loading}>
          {loading ? 'Thinking...' : 'Ask Ava'}
        </button>
        {response && (
          <div className="ava-response">
            <div className="ava-answer">
              {response.answer?.split('\n').map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
            {response.data?.sources && response.data.sources.length > 0 && (
              <div className="ava-sources">
                <div className="ava-sources-title">Sources</div>
                {response.data.sources.map((source, idx) => (
                  <div key={idx} className="ava-source-item">
                    {source.page ? `Page ${source.page}` : 'Source'} {source.label ? `- ${source.label}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
