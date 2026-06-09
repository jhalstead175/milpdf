export default function ExportWorkspace({
  objects,
  watermarkText,
  renderDoc,
  onExportJson,
  onImportJson,
  onSave,
  onSaveAs,
  onExportWord,
  onToggleWatermark,
  onPrint,
  onInsertPdfPages,
  onCreatePdfFromImages,
  nextActions = [],
  blockers = [],
  readinessLabel,
  activityLog = [],
  exportReceipts = [],
}) {
  return (
    <section className="workspace-screen workspace-grid-two">
      <div className="context-card">
        <div className="context-card-title">Export Checklist</div>
        <div className="workspace-list">
          <div className="workspace-list-row">
            <span>Annotations captured</span>
            <strong>{objects.length}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Document loaded</span>
            <strong>{renderDoc ? 'Yes' : 'No'}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Watermark</span>
            <strong>{watermarkText ? 'Enabled' : 'None'}</strong>
          </div>
          <div className="workspace-list-row">
            <span>Production readiness</span>
            <strong>{readinessLabel || (renderDoc ? 'Ready for export review' : 'Document required')}</strong>
          </div>
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">Next Best Actions</div>
        <div className="workflow-guidance-copy">
          Finish export-safe checks first, then save the production copy in the format you need.
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
          <div className="workflow-clear-state">No export blockers are currently open.</div>
        )}
      </div>

      <div className="context-card">
        <div className="context-card-title">Activity Log</div>
        {activityLog.length > 0 ? (
          <div className="activity-log-list">
            {activityLog.map((item) => (
              <div key={item.id} className="activity-log-item">
                <strong>{item.label}</strong>
                {item.detail ? <span>{item.detail}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="panel-empty">Recent workflow actions will appear here.</div>
        )}
      </div>

      <div className="context-card">
        <div className="context-card-title">Export Receipts</div>
        {exportReceipts.length > 0 ? (
          <div className="activity-log-list export-receipt-list">
            {exportReceipts.map((receipt) => (
              <div key={receipt.id} className="activity-log-item export-receipt-item">
                <strong>{receipt.label}</strong>
                {receipt.detail ? <span>{receipt.detail}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="panel-empty">Completed exports and production saves will appear here.</div>
        )}
      </div>

      <div className="context-card">
        <div className="context-card-title">Export Actions</div>
        <div className="context-actions">
          <button className="btn-secondary" onClick={onExportJson} disabled={!renderDoc}>Export JSON</button>
          <button className="btn-secondary" onClick={onImportJson} disabled={!renderDoc}>Import JSON</button>
          <button className="btn-secondary" onClick={onSave} disabled={!renderDoc}>Save PDF</button>
          <button className="btn-secondary" onClick={onSaveAs} disabled={!renderDoc}>Save As</button>
          <button className="btn-secondary" onClick={onInsertPdfPages} disabled={!renderDoc}>Insert PDF Pages</button>
          <button className="btn-secondary" onClick={onCreatePdfFromImages}>Create PDF from Images</button>
          <button className="btn-secondary" onClick={onExportWord} disabled={!renderDoc}>Export Word</button>
          <button className="btn-secondary" onClick={onToggleWatermark} disabled={!renderDoc}>
            {watermarkText ? 'Remove Watermark' : 'Add Watermark'}
          </button>
          <button className="btn-secondary" onClick={onPrint} disabled={!renderDoc}>Print</button>
        </div>
      </div>
    </section>
  );
}
