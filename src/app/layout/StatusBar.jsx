export default function StatusBar({
  page,
  numPages,
  zoom,
  findingsCount,
  exportReady,
  unsavedChanges,
}) {
  return (
    <div className="status-bar">
      <span>Page {page} of {numPages || 0}</span>
      <span>Zoom {Math.round((zoom || 1) * 100)}%</span>
      <span>{findingsCount} active review items</span>
      <span>{unsavedChanges ? 'Changes not saved' : 'All changes saved'}</span>
      <span>{exportReady ? 'Ready for export' : 'Review required before export'}</span>
    </div>
  );
}
