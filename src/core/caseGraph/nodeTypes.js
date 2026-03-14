export const NODE_TYPES = {
  person: 'person',
  document: 'document',
  event: 'event',
  location: 'location',
  evidence: 'evidence',
};

export function createNode({ id, type, label, data = {} }) {
  return {
    id,
    type,
    data: { label, ...data },
    position: { x: 0, y: 0 },
  };
}
