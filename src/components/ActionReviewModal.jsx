export default function ActionReviewModal({
  action,
  loading = false,
  onApprove,
  onClose,
}) {
  if (!action) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal action-review-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{action.label}</h3>
        <p className="modal-hint">{action.description}</p>

        <div className="workspace-list">
          <div className="workspace-list-row">
            <span>Scope</span>
            <strong>{action.scope}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Expected output</span>
            <strong>{action.outputLabel}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Review mode</span>
            <strong>{action.reviewLabel}</strong>
          </div>
        </div>

        <div className="action-review-notes">
          <div className="context-card-title">Execution Notes</div>
          <ul className="action-review-list">
            {action.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => onApprove(action)} disabled={loading}>
            {loading ? 'Running…' : 'Approve and Run'}
          </button>
        </div>
      </div>
    </div>
  );
}
