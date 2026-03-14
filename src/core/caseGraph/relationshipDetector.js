import { EDGE_TYPES, createEdge } from './edgeTypes';

function uniqueEdgeId(source, target, type) {
  return `${source}-${type}-${target}`;
}

export function detectRelationships({ evidenceIndex, documentIndex }) {
  const edges = [];
  const markerByPage = new Map();
  for (const marker of evidenceIndex.markers || []) {
    if (!markerByPage.has(marker.page)) markerByPage.set(marker.page, []);
    markerByPage.get(marker.page).push(marker);
  }

  if (documentIndex?.entities) {
    for (const entity of documentIndex.entities) {
      const markers = markerByPage.get(entity.page) || [];
      for (const marker of markers) {
        const source = `evidence-${marker.id}`;
        const target = `${entity.type}-${entity.page}-${entity.text}`;
        edges.push(createEdge({
          id: uniqueEdgeId(source, target, EDGE_TYPES.referenced),
          source,
          target,
          type: EDGE_TYPES.referenced,
          label: 'referenced',
        }));
      }
    }
  }

  return edges;
}
