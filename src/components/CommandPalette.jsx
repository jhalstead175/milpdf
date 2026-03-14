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
    const allowed = commands.filter(cmd => !cmd.requiresDoc || hasDoc);
    if (!q) {
      const recentIds = JSON.parse(localStorage.getItem('cmd_recent') || '[]');
      const recent = recentIds
        .map(id => allowed.find(cmd => cmd.id === id))
        .filter(Boolean)
        .slice(0, 8);
      if (recent.length > 0) {
        return { items: recent, mode: 'recent' };
      }
      return { items: allowed.slice(0, 10), mode: 'all' };
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const scored = allowed.map(cmd => {
      const label = cmd.label.toLowerCase();
      const id = cmd.id.toLowerCase();
      const category = (cmd.category || '').toLowerCase();
      const keywords = (cmd.keywords || []).map(k => k.toLowerCase());
      let score = 0;

      const scoreToken = (token) => {
        if (label.startsWith(token)) score += 120;
        if (label.includes(token)) score += 60;
        if (id.includes(token)) score += 25;
        if (category.includes(token)) score += 15;
        if (keywords.some(k => k.includes(token))) score += 30;
        if (cmd.shortcut && cmd.shortcut.toLowerCase().includes(token)) score += 10;
      };

      tokens.forEach(scoreToken);
      return { cmd, score };
    });

    return {
      items: scored
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ cmd }) => cmd)
        .slice(0, 12),
      mode: 'search',
    };
  }, [query, commands, hasDoc])();

  useEffect(() => {
    if (highlighted > results.items.length - 1) {
      setHighlighted(0);
    }
  }, [results.items.length, highlighted]);

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
      setHighlighted(h => Math.min(h + 1, results.items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.items[highlighted]) executeCommand(results.items[highlighted]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results.items, highlighted, executeCommand, onClose]);

  if (!isOpen) return null;

  const grouped = (() => {
    if (results.mode === 'recent') {
      return [{ label: 'Recent', items: results.items }];
    }
    if (results.mode === 'all') {
      return [{ label: 'Commands', items: results.items }];
    }
    const map = new Map();
    results.items.forEach(cmd => {
      const label = cmd.category || 'Commands';
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(cmd);
    });
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  })();

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <span className="cmd-search-icon">⌕</span>
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
          {grouped.map(group => (
            <div key={group.label} className="cmd-group">
              <div className="cmd-group-label">{group.label}</div>
              {group.items.map((cmd) => {
                const globalIdx = results.items.indexOf(cmd);
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
          {results.items.length === 0 && (
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
