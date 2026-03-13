export function bringForward(objects, id) {
  const sorted = [...objects].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const idx = sorted.findIndex(o => o.id === id);
  if (idx < 0 || idx === sorted.length - 1) return [];
  const above = sorted[idx + 1];
  const current = sorted[idx];
  return [
    { id: current.id, zIndex: above.zIndex },
    { id: above.id, zIndex: current.zIndex },
  ];
}

export function sendBackward(objects, id) {
  const sorted = [...objects].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const idx = sorted.findIndex(o => o.id === id);
  if (idx <= 0) return [];
  const below = sorted[idx - 1];
  const current = sorted[idx];
  return [
    { id: current.id, zIndex: below.zIndex },
    { id: below.id, zIndex: current.zIndex },
  ];
}
export function bringToFront(objects, id) {
  const maxZ = Math.max(...objects.map(o => o.zIndex ?? 0));
  return [{ id, zIndex: maxZ + 1 }];
}

export function sendToBack(objects, id) {
  const minZ = Math.min(...objects.map(o => o.zIndex ?? 0));
  return [{ id, zIndex: minZ - 1 }];
}
