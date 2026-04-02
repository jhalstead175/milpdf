export default function PacketWorkspace({
  findings = [],
  evidenceItems = [],
  onGoExport,
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
            <strong>{evidenceItems.length > 0 ? 'Packet draft available' : 'Evidence still needed'}</strong>
          </div>
        </div>
        <div className="context-actions">
          <button type="button" className="btn-primary" onClick={onGoExport} disabled={evidenceItems.length === 0}>
            Open export workspace
          </button>
        </div>
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
