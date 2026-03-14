export function buildEvidenceIndex(objects = []) {
  const markers = objects
    .filter(obj => obj.type === 'evidenceMarker')
    .map(obj => ({
      id: obj.id,
      page: obj.page,
      pdfX: obj.pdfX,
      pdfY: obj.pdfY,
      label: obj.label || obj.name || `Marker ${String(obj.id).slice(0, 6)}`,
      exhibitId: obj.exhibitId || 'unassigned',
      description: obj.description || '',
      timestamp: obj.timestamp || null,
      tags: Array.isArray(obj.tags) ? obj.tags : [],
    }))
    .sort((a, b) => (a.page - b.page) || a.label.localeCompare(b.label));

  const exhibitsMap = new Map();
  for (const marker of markers) {
    if (!exhibitsMap.has(marker.exhibitId)) {
      exhibitsMap.set(marker.exhibitId, {
        id: marker.exhibitId,
        label: marker.exhibitId === 'unassigned' ? 'Unassigned' : marker.exhibitId,
        description: '',
        markers: [],
      });
    }
    exhibitsMap.get(marker.exhibitId).markers.push(marker);
  }

  const exhibits = [...exhibitsMap.values()].sort((a, b) => a.label.localeCompare(b.label));

  return {
    markers,
    exhibits,
  };
}

export function createEvidenceMarker({
  page,
  pdfX,
  pdfY,
  label = 'Evidence Marker',
  exhibitId = 'unassigned',
  description = '',
  timestamp = null,
  tags = [],
} = {}) {
  return {
    type: 'evidenceMarker',
    page,
    pdfX,
    pdfY,
    width: 0,
    height: 0,
    label,
    exhibitId,
    description,
    timestamp,
    tags,
    visible: false,
    locked: true,
    name: label,
    opacity: 1,
    layerId: 'annotations',
  };
}
