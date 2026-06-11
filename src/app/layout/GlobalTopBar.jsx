import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function GlobalTopBar({
  workspaceLabel,
  matterName,
  documentName,
  saveState,
  pageSummary,
  readinessLabel,
  blockerCount = 0,
  lastAction,
  onOpenCommandPalette,
  onToggleAssistant,
  onOpen,
  onOpenDisabled = false,
  onClose,
  onCloseDisabled = false,
  documentActions = [],
  onSave,
  onExport,
}) {
  const [docMenuOpen, setDocMenuOpen] = useState(false);
  const docMenuRef = useRef(null);

  useEffect(() => {
    if (!docMenuOpen) return undefined;
    const onDocClick = (e) => {
      if (docMenuRef.current && !docMenuRef.current.contains(e.target)) setDocMenuOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [docMenuOpen]);

  return (
    <header className="global-topbar">
      <div className="global-topbar-context">
        <div className="global-topbar-eyebrow">{workspaceLabel}</div>
        <div className="global-topbar-title-row">
          <h1>{matterName}</h1>
          <span className="global-topbar-divider">/</span>
          <span className="global-topbar-document" title={documentName}>
            {documentName}
          </span>
        </div>
        {lastAction ? (
          <div className="global-topbar-last-action" title={lastAction.detail || lastAction.label}>
            Last action: {lastAction.label}
          </div>
        ) : null}
      </div>

      <div className="global-topbar-actions">
        {onOpen ? (
          <button type="button" className="btn-secondary" onClick={onOpen} disabled={onOpenDisabled}>
            Open
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="btn-secondary" onClick={onClose} disabled={onCloseDisabled}>
            Close
          </button>
        ) : null}
        {documentActions.length > 0 ? (
          <div className="topbar-menu" ref={docMenuRef}>
            <button
              type="button"
              className="btn-secondary topbar-menu-trigger"
              onClick={() => setDocMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={docMenuOpen}
            >
              Document <ChevronDown size={13} strokeWidth={2} />
            </button>
            {docMenuOpen ? (
              <div className="topbar-menu-panel" role="menu">
                {documentActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    className="topbar-menu-item"
                    disabled={action.disabled}
                    onClick={() => { setDocMenuOpen(false); action.onClick?.(); }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <button type="button" className="btn-secondary" onClick={onOpenCommandPalette}>
          Commands
        </button>
        <div className="global-topbar-status">
          <span className="status-pill">{saveState}</span>
          <span className={`status-pill ${blockerCount > 0 ? 'warning' : 'ready'}`}>{readinessLabel}</span>
          <span className="status-pill subtle">{pageSummary}</span>
        </div>
        <button type="button" className="btn-secondary" onClick={onToggleAssistant}>
          AI Review
        </button>
        <button type="button" className="btn-secondary" onClick={onSave}>
          Save
        </button>
        <button type="button" className="btn-primary" onClick={onExport}>
          Open Export
        </button>
      </div>
    </header>
  );
}
