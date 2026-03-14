export const EDGE_TYPES = {
  sent: 'sent',
  signed: 'signed',
  transferred: 'transferred',
  referenced: 'referenced',
};

export function createEdge({ id, source, target, type, label }) {
  return {
    id,
    source,
    target,
    type,
    label,
  };
}
