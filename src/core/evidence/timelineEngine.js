export function buildEvidenceTimeline(markers = []) {
  return [...markers]
    .filter(marker => marker.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}
