import { useEffect, useState } from 'react';
import AvaIntroCard from '../../components/assistant/AvaIntroCard';
import AvaPanel from '../../components/AvaPanel';

const DEFAULT_ACTIONS = [
  { id: 'summarize_page', label: 'Summarize current page', description: 'Capture the key evidence on the current page.' },
  { id: 'extract_dates', label: 'Extract timeline dates', description: 'Build a date-focused review queue.' },
  { id: 'find_pii', label: 'Flag sensitive data', description: 'Detect sensitive data before export.' },
  { id: 'draft_exhibit_note', label: 'Draft evidence note', description: 'Generate a concise evidence summary.' },
];

export default function AssistantDock({
  onAsk,
  onRunSuggestedAction,
  introActions = [],
  actions = DEFAULT_ACTIONS,
  runHistory = [],
  hasDocument = false,
  documentName,
}) {
  const [seedQuestion, setSeedQuestion] = useState('');

  useEffect(() => {
    setSeedQuestion('');
  }, [hasDocument, documentName]);

  return (
    <div className="assistant-dock">
      <AvaIntroCard
        actions={introActions}
        hasDocument={hasDocument}
        documentName={documentName}
      />
      <div className="context-card">
        <div className="context-card-title">Recommended AI Actions</div>
        <div className="assistant-chip-list">
          {actions.map((action) => (
            <button
              key={action.id || action.label || action}
              type="button"
              className="assistant-chip"
              onClick={() => {
                const actionId = action.id || action;
                const nextPrompt = onRunSuggestedAction(actionId);
                if (typeof nextPrompt === 'string') setSeedQuestion(nextPrompt);
              }}
            >
              {action.label || action}
            </button>
          ))}
        </div>
      </div>
      <div className="context-card">
        <div className="context-card-title">AI Action History</div>
        <div className="assistant-run-history">
          {runHistory.map((run) => (
            <div key={run.id} className="assistant-run-row">
              <strong>{run.label}</strong>
              <span>{run.outcome}</span>
            </div>
          ))}
          {runHistory.length === 0 ? (
            <div className="context-muted">Approved AI actions will appear here.</div>
          ) : null}
        </div>
      </div>
      <AvaPanel
        onAsk={onAsk}
        suggestedPrompts={actions.map((action) => action.label || action)}
        seedQuestion={seedQuestion}
        placeholder={hasDocument
          ? 'Ask Ava to summarize, extract dates, or spot sensitive data.'
          : 'Upload a document first, then ask Ava for help with review or claim prep.'}
      />
    </div>
  );
}
