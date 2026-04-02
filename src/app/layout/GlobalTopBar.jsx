export default function GlobalTopBar({
  workspaceLabel,
  matterName,
  documentName,
  saveState,
  pageSummary,
  onOpenCommandPalette,
  onToggleAssistant,
  onSave,
  onExport,
}) {
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
      </div>

      <div className="global-topbar-actions">
        <button type="button" className="btn-secondary" onClick={onOpenCommandPalette}>
          Commands
        </button>
        <div className="global-topbar-status">
          <span className="status-pill">{saveState}</span>
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
