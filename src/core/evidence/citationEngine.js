export function formatCitation(marker, batesLabel) {
  const exhibit = marker.exhibitId || 'unassigned';
  const label = marker.label || '';
  return `${exhibit} ${label}${batesLabel ? ` (${batesLabel})` : ''}`.trim();
}
