import EvidencePanel from '../../components/EvidencePanel';

export default function PrepareWorkspace({
  evidenceIndex,
  onJumpToPage,
  onExportBundle,
  onGoExport,
}) {
  return (
    <section className="workspace-screen workspace-grid-two">
      <div className="context-card">
        <div className="context-card-title">Packet Preparation</div>
        <div className="workspace-list">
          <div className="workspace-list-row">
            <span>Review packet structure</span>
            <strong>Ready</strong>
          </div>
          <div className="workspace-list-row">
            <span>Label exhibits</span>
            <strong>{evidenceIndex.exhibits.length}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Bundle markers</span>
            <strong>{evidenceIndex.markers.length}</strong>
          </div>
        </div>
        <div className="context-actions">
          <button type="button" className="btn-primary" onClick={onGoExport}>
            Review export checklist
          </button>
        </div>
      </div>
      <EvidencePanel
        markers={evidenceIndex.markers}
        exhibits={evidenceIndex.exhibits}
        onJumpToPage={onJumpToPage}
        onExportBundle={onExportBundle}
      />
    </section>
  );
}
