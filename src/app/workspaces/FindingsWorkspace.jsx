const FILTERS = [
  { id: 'all', label: 'All Items' },
  { id: 'proposed', label: 'Needs Review' },
  { id: 'accepted', label: 'Approved' },
  { id: 'rejected', label: 'Excluded' },
];

export default function FindingsWorkspace({
  findings = [],
  activeFilter = 'all',
  selectedFindingId,
  onFilterChange,
  onSelectFinding,
  onAcceptFinding,
  onRejectFinding,
  onPromoteFinding,
  onJumpToPage,
  nextActions = [],
}) {
  const visibleFindings = findings.filter((finding) => (
    activeFilter === 'all' ? true : finding.status === activeFilter
  ));
  const selectedFinding = visibleFindings.find((finding) => finding.id === selectedFindingId) || null;

  return (
    <section className="workspace-screen findings-workspace">
      <div className="workspace-panel findings-shell">
        <div className="workspace-panel-header">
          <div className="findings-filter-row">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`workspace-panel-tab ${activeFilter === filter.id ? 'active' : ''}`}
                onClick={() => onFilterChange(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="findings-layout">
          <div className="findings-list">
            <div className="context-card workflow-guidance-card">
              <div className="context-card-title">Next Best Actions</div>
              <div className="workflow-guidance-copy">
                Resolve the highest-value review items first, then promote approved items into evidence.
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
            {visibleFindings.map((finding) => (
              <button
                key={finding.id}
                type="button"
                className={`finding-row ${selectedFindingId === finding.id ? 'active' : ''}`}
                onClick={() => onSelectFinding(finding.id)}
              >
                <span className="finding-row-type">{finding.typeLabel || finding.type}</span>
                <strong>{finding.title}</strong>
                <span>{finding.summary}</span>
                <span className="finding-row-meta">
                  Page {finding.page || 1} - {finding.status === 'proposed' ? 'needs review' : finding.status === 'accepted' ? 'approved' : 'excluded'}
                </span>
              </button>
            ))}
            {visibleFindings.length === 0 ? (
              <div className="panel-empty">No review items match this filter.</div>
            ) : null}
          </div>

          <div className="findings-detail">
            {selectedFinding ? (
              <div className="context-card">
                <div className="context-card-title">Review Item Detail</div>
                <div className="workspace-list">
                  <div className="workspace-list-row">
                    <span>Type</span>
                    <strong>{selectedFinding.typeLabel || selectedFinding.type}</strong>
                  </div>
                  <div className="workspace-list-row">
                    <span>Status</span>
                    <strong>{selectedFinding.status === 'proposed' ? 'Needs review' : selectedFinding.status === 'accepted' ? 'Approved' : 'Excluded'}</strong>
                  </div>
                  <div className="workspace-list-row">
                    <span>Page</span>
                    <strong>{selectedFinding.page || 1}</strong>
                  </div>
                </div>
                <p className="finding-detail-copy">{selectedFinding.summary}</p>
                {selectedFinding.detail ? (
                  <div className="finding-detail-body">{selectedFinding.detail}</div>
                ) : null}
                <div className="context-actions">
                  <button type="button" className="btn-primary" onClick={() => onAcceptFinding(selectedFinding.id)}>
                    Approve Item
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => onPromoteFinding(selectedFinding.id)}>
                    Promote to Evidence
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => onJumpToPage(selectedFinding.page || 1)}>
                    Jump to Page
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => onRejectFinding(selectedFinding.id)}>
                    Exclude Item
                  </button>
                </div>
              </div>
            ) : (
              <div className="context-card">
                <div className="context-card-title">Review Item Detail</div>
                <div className="context-muted">Select a review item to inspect and route it.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
