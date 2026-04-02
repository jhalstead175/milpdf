export default function EvidenceWorkspace({
  evidenceItems = [],
  onJumpToPage,
  onGoPacket,
}) {
  return (
    <section className="workspace-screen workspace-grid-two evidence-workspace">
      <div className="context-card">
        <div className="context-card-title">Evidence Board</div>
        <div className="workspace-list">
          {evidenceItems.map((item) => (
            <div key={item.id} className="workspace-list-row evidence-board-row">
              <div className="evidence-board-copy">
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </div>
              <div className="evidence-board-actions">
                <span className="evidence-page">p{item.page || 1}</span>
                <button type="button" className="btn-secondary" onClick={() => onJumpToPage(item.page || 1)}>
                  Open
                </button>
              </div>
            </div>
          ))}
          {evidenceItems.length === 0 ? (
            <div className="panel-empty">Promote a finding to create the first evidence item.</div>
          ) : null}
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">Packet Readiness</div>
        <div className="workspace-list">
          <div className="workspace-list-row">
            <span>Evidence items</span>
            <strong>{evidenceItems.length}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Packet status</span>
            <strong>{evidenceItems.length > 0 ? 'Ready for packet draft' : 'Awaiting evidence'}</strong>
          </div>
        </div>
        <div className="context-actions">
          <button type="button" className="btn-primary" onClick={onGoPacket} disabled={evidenceItems.length === 0}>
            Build packet
          </button>
        </div>
      </div>
    </section>
  );
}
