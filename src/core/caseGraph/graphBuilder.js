import { NODE_TYPES, createNode } from './nodeTypes';
import { EDGE_TYPES, createEdge } from './edgeTypes';
import { detectRelationships } from './relationshipDetector';

function layoutNodes(nodes) {
  const spacingX = 220;
  const spacingY = 120;
  return nodes.map((node, index) => ({
    ...node,
    position: { x: (index % 4) * spacingX, y: Math.floor(index / 4) * spacingY },
  }));
}

export function buildCaseGraph({ evidenceIndex, documentIndex, pages } = {}) {
  const nodes = [];
  const edges = [];

  if (pages?.length) {
    pages.forEach(page => {
      nodes.push(createNode({
        id: `doc-page-${page.number}`,
        type: NODE_TYPES.document,
        label: `Page ${page.number}`,
        data: { page: page.number },
      }));
    });
  }

  for (const marker of evidenceIndex?.markers || []) {
    nodes.push(createNode({
      id: `evidence-${marker.id}`,
      type: NODE_TYPES.evidence,
      label: marker.label || marker.exhibitId,
      data: { page: marker.page, markerId: marker.id },
    }));
    edges.push(createEdge({
      id: `edge-${marker.id}-page`,
      source: `evidence-${marker.id}`,
      target: `doc-page-${marker.page}`,
      type: EDGE_TYPES.referenced,
      label: 'referenced',
    }));
  }

  for (const entity of documentIndex?.entities || []) {
    let type = NODE_TYPES.event;
    if (entity.type === 'email' || entity.type === 'phone') type = NODE_TYPES.person;
    nodes.push(createNode({
      id: `${entity.type}-${entity.page}-${entity.text}`,
      type,
      label: entity.text,
      data: { page: entity.page },
    }));
  }

  const relationshipEdges = detectRelationships({ evidenceIndex, documentIndex });
  edges.push(...relationshipEdges);

  const positioned = layoutNodes(nodes);
  return { nodes: positioned, edges };
}
