import { useEffect, useMemo, useState } from 'react';

function normalizeResponse(result) {
  if (!result) return null;

  return {
    answer: result.answer || result.content || result.message || '',
    sources: result.data?.sources || result.sources || [],
  };
}

export default function AvaPanel({
  onAsk,
  placeholder = 'Ask for a summary, timeline, contradiction check, or redaction review...',
  suggestedPrompts = [],
  seedQuestion = '',
}) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status] = useState('local');
  const normalizedResponse = useMemo(() => normalizeResponse(response), [response]);

  useEffect(() => {
    if (seedQuestion) {
      setQuestion(seedQuestion);
    }
  }, [seedQuestion]);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await onAsk(question.trim());
      setResponse(result);
    } catch (err) {
      setError(err.message || 'Ava could not answer that request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel ava-panel">
      <div className="panel-header">
        Ava (AI Review)
        <span className={`ava-status ${status}`}>{status}</span>
      </div>
      <div className="panel-body">
        <div className="ava-avatar-row">
          <img
            className="ava-avatar"
            src="/images/ava_bridgestone.png"
            alt="Ava Bridgestone"
          />
          <div className="ava-avatar-text">
            <div className="ava-avatar-name">Ava Bridgestone</div>
            <div className="ava-avatar-subtitle">Advocate's Bridge</div>
          </div>
        </div>
        <div className="field">
          <label>Review Request</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={placeholder}
          />
        </div>
        {suggestedPrompts.length > 0 ? (
          <div className="assistant-chip-list">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="assistant-chip"
                onClick={() => setQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
        <button className="btn-primary" onClick={handleAsk} disabled={loading}>
          {loading ? 'Reviewing...' : 'Run AI Review'}
        </button>
        {!normalizedResponse && !error ? (
          <div className="ava-response ava-response-empty">
            <div className="ava-answer">
              Ask Ava for a summary, issue review, redaction check, or next-step guidance.
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="ava-response ava-response-error">
            <div className="ava-answer">{error}</div>
          </div>
        ) : null}
        {normalizedResponse ? (
          <div className="ava-response">
            <div className="ava-answer">
              {normalizedResponse.answer.split('\n').map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
            {normalizedResponse.sources.length > 0 ? (
              <div className="ava-sources">
                <div className="ava-sources-title">Sources</div>
                {normalizedResponse.sources.map((source, idx) => (
                  <div key={idx} className="ava-source-item">
                    {source.page ? `Page ${source.page}` : 'Source'} {source.label ? `- ${source.label}` : ''}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
