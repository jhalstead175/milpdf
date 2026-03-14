import { useState, useCallback, useEffect, useRef } from 'react';
export default function CommandPalette({ isOpen, onClose, commands, onExecute, hasDoc }) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = useCallback(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      const recent = JSON.parse(localStorage.getItem('cmd_recent') || '[]');
      return commands
        .filter(cmd => !cmd.requiresDoc || hasDoc)
        .sort((a, b) => recent.indexOf(b.id) - recent.indexOf(a.id))
        .slice(0, 8);
    }

    return commands
      .filter(cmd => !cmd.requiresDoc || hasDoc)
      .map(cmd => {
        const label = cmd.label.toLowerCase();
        const labelMatch = label.includes(q);
        const exactLabel = label.startsWith(q);
        const kwMatch = (cmd.keywords || []).some(k => k.includes(q));
        const score = (exactLabel ? 100 : 0) + (labelMatch ? 50 : 0) + (kwMatch ? 20 : 0);
        return { cmd, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd)
      .slice(0, 10);
  }, [query, commands, hasDoc])();

  const executeCommand = useCallback((cmd) => {
    const recent = JSON.parse(localStorage.getItem('cmd_recent') || '[]');
    localStorage.setItem(
      'cmd_recent',
      JSON.stringify([cmd.id, ...recent.filter(id => id !== cmd.id)].slice(0, 20))
    );
    onExecute(cmd.id);
    onClose();
  }, [onExecute, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlighted]) executeCommand(results[highlighted]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, highlighted, executeCommand, onClose]);

  if (!isOpen) return null;

  const grouped = results.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <span className="cmd-search-icon">*</span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Type a command or search"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlighted(0); }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmd-esc-hint">ESC</kbd>
        </div>

        <div className="cmd-results">
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category} className="cmd-group">
              <div className="cmd-group-label">{category}</div>
              {cmds.map((cmd) => {
                const globalIdx = results.indexOf(cmd);
                return (
                  <div
                    key={cmd.id}
                    className={`cmd-item ${globalIdx === highlighted ? 'highlighted' : ''} ${cmd.destructive ? 'destructive' : ''}`}
                    onMouseEnter={() => setHighlighted(globalIdx)}
                    onClick={() => executeCommand(cmd)}
                  >
                    <span className="cmd-label">{highlightMatch(cmd.label, query)}</span>
                    {cmd.shortcut && <kbd className="cmd-shortcut">{cmd.shortcut}</kbd>}
                  </div>
                );
              })}
            </div>
          ))}
          {results.length === 0 && (
            <div className="cmd-empty">No commands found for "{query}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

function highlightMatch(label, query) {
  if (!query) return label;
  const idx = label.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return label;
  return (
    <>
      {label.slice(0, idx)}
      <strong>{label.slice(idx, idx + query.length)}</strong>
      {label.slice(idx + query.length)}
    </>
  );
}
