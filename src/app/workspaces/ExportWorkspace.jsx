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
  onRunHealthCheck,
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
        </div>
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
          {import.meta.env?.DEV && (
            <button className="btn-secondary" onClick={onRunHealthCheck}>Kernel Health</button>
          )}
        </div>
      </div>
    </section>
  );
}
