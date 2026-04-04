export default function PacketWorkspace({
  findings = [],
  evidenceItems = [],
  onGoExport,
  nextActions = [],
  blockers = [],
  readinessLabel,
}) {
  const acceptedFindings = findings.filter((finding) => finding.status === 'accepted').length;

  return (
    <section className="workspace-screen workspace-grid-two packet-workspace">
      <div className="context-card">
        <div className="context-card-title">Packet Draft</div>
        <div className="workspace-list">
          <div className="workspace-list-row">
            <span>Approved review items</span>
            <strong>{acceptedFindings}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Evidence items</span>
            <strong>{evidenceItems.length}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Export readiness</span>
            <strong>{readinessLabel || (evidenceItems.length > 0 ? 'Packet draft available' : 'Evidence still needed')}</strong>
          </div>
        </div>
        <div className="context-actions">
          <button type="button" className="btn-primary" onClick={onGoExport} disabled={evidenceItems.length === 0}>
            Open export workspace
          </button>
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">Next Best Actions</div>
        <div className="workflow-guidance-copy">
          Turn approved review items into a complete packet before moving to production export.
        </div>
        <div className="workflow-action-list">
          {nextActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.primary ? 'btn-primary' : 'btn-secondary'}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">Production Blockers</div>
        {blockers.length > 0 ? (
          <div className="workflow-blocker-list">
            {blockers.map((blocker) => (
              <div key={blocker.id || blocker.label} className="workflow-blocker-item">
                <div className="workflow-blocker-copy">{blocker.label || blocker}</div>
                {blocker.actionLabel ? (
                  <button
                    type="button"
                    className="btn-secondary workflow-blocker-action"
                    onClick={blocker.onAction}
                    disabled={blocker.disabled}
                  >
                    {blocker.actionLabel}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="workflow-clear-state">No production blockers are currently open.</div>
        )}
      </div>

      <div className="context-card">
        <div className="context-card-title">Checklist</div>
        <div className="workspace-list">
          <div className="workspace-list-row">
            <span>Review items approved</span>
            <strong>{acceptedFindings}/{findings.length}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Evidence linked</span>
            <strong>{evidenceItems.length}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Manual export review</span>
            <strong>Required</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
