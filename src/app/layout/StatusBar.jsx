export default function StatusBar({
  page,
  numPages,
  zoom,
  findingsCount,
  exportReady,
  unsavedChanges,
  blockerCount = 0,
  readinessLabel,
  lastAction,
}) {
  return (
    <div className="status-bar">
      <span>Page {page} of {numPages || 0}</span>
      <span>Zoom {Math.round((zoom || 1) * 100)}%</span>
      <span>{findingsCount} active review items</span>
      <span>{blockerCount} export blocker{blockerCount === 1 ? '' : 's'}</span>
      <span>{unsavedChanges ? 'Changes not saved' : 'All changes saved'}</span>
      <span>{readinessLabel || (exportReady ? 'Ready for export' : 'Review required before export')}</span>
      {lastAction ? <span>Last action: {lastAction.label}</span> : null}
    </div>
  );
}
