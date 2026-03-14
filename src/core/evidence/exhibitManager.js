export function createExhibit(id, label, description = '') {
  return {
    id,
    label: label || id,
    description,
    markers: [],
  };
}

export function upsertExhibit(exhibits, exhibit) {
  const next = [...exhibits];
  const idx = next.findIndex(item => item.id === exhibit.id);
  if (idx >= 0) next[idx] = { ...next[idx], ...exhibit };
  else next.push(exhibit);
  return next;
}

export function removeExhibit(exhibits, id) {
  return exhibits.filter(item => item.id !== id);
}

export function assignMarkerToExhibit(markers, markerId, exhibitId) {
  return markers.map(marker => (
    marker.id === markerId ? { ...marker, exhibitId } : marker
  ));
}
