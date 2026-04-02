export default function MatterWorkspace({
  fileName,
  numPages,
  evidenceIndex,
  caseGraph,
  onGoReview,
  onGoPrepare,
}) {
  return (
    <section className="workspace-screen workspace-grid-two">
      <div className="context-card">
        <div className="context-card-title">Matter Summary</div>
        <div className="workspace-metric-grid">
          <div className="workspace-metric">
            <span>Current document</span>
            <strong>{fileName}</strong>
          </div>
          <div className="workspace-metric">
            <span>Pages</span>
            <strong>{numPages || 0}</strong>
          </div>
          <div className="workspace-metric">
            <span>Evidence markers</span>
            <strong>{evidenceIndex.markers.length}</strong>
          </div>
          <div className="workspace-metric">
            <span>Exhibits</span>
            <strong>{evidenceIndex.exhibits.length}</strong>
          </div>
        </div>
        <div className="context-actions">
          <button type="button" className="btn-primary" onClick={onGoReview}>
            Continue review
          </button>
          <button type="button" className="btn-secondary" onClick={onGoPrepare}>
            Prepare packet
          </button>
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">Matter Intelligence</div>
        <div className="workspace-list">
          <div className="workspace-list-row">
            <span>Linked nodes</span>
            <strong>{caseGraph.nodes?.length || 0}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Detected relationships</span>
            <strong>{caseGraph.edges?.length || 0}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Status</span>
            <strong>{numPages ? 'Active' : 'Awaiting document'}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
