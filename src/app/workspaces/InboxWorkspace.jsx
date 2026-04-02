export default function InboxWorkspace({
  matterName,
  fileName,
  numPages,
  findings = [],
  evidenceItems = [],
  suggestedActions = [],
  toolGroups = [],
  onOpenDocument,
  onCreatePdfFromImages,
  onGoReview,
  onGoFindings,
  onRunSuggestedAction,
}) {
  const highPriorityFindings = findings.filter((finding) => finding.status === 'proposed').length;

  return (
    <section className="workspace-screen workspace-grid-two phase3-inbox">
      <div className="context-card">
        <div className="context-card-title">Matter Intake</div>
        <div className="workspace-metric-grid">
          <div className="workspace-metric">
            <span>Matter</span>
            <strong>{matterName}</strong>
          </div>
          <div className="workspace-metric">
            <span>Document</span>
            <strong>{fileName}</strong>
          </div>
          <div className="workspace-metric">
            <span>Pages loaded</span>
            <strong>{numPages || 0}</strong>
          </div>
          <div className="workspace-metric">
            <span>Pending findings</span>
            <strong>{highPriorityFindings}</strong>
          </div>
          <div className="workspace-metric">
            <span>Evidence items</span>
            <strong>{evidenceItems.length}</strong>
          </div>
        </div>
        <div className="context-actions">
          <button type="button" className="btn-primary" onClick={onOpenDocument}>
            Open document
          </button>
          <button type="button" className="btn-secondary" onClick={onCreatePdfFromImages}>
            Create PDF from images
          </button>
          <button type="button" className="btn-secondary" onClick={onGoReview}>
            Continue review
          </button>
          <button type="button" className="btn-secondary" onClick={onGoFindings}>
            Review findings
          </button>
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">Suggested Actions</div>
        <div className="assistant-action-list">
          {suggestedActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="assistant-action-card"
              onClick={() => onRunSuggestedAction(action.id)}
              disabled={action.disabled}
            >
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </button>
          ))}
          {suggestedActions.length === 0 ? (
            <div className="context-muted">Load a document to unlock suggested workflows.</div>
          ) : null}
        </div>
      </div>

      <div className="context-card context-card-span-2">
        <div className="context-card-title">PDF Tool Library</div>
        <div className="tool-groups-grid">
          {toolGroups.map((group) => (
            <section key={group.id} className="tool-group-card">
              <div className="tool-group-header">
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <span className="tool-group-pill">{group.items.length} tools</span>
              </div>
              <div className="tool-group-list">
                {group.items.map((item) => (
                  <div key={item.label} className="tool-list-item">
                    <div className="tool-list-copy">
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={item.onAction}
                      disabled={item.disabled}
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
