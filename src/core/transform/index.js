import { snapPosition, snapGuidesToScreen } from '../../editor/snapping';

const MIN_SIZE = 4;

function clampSize(value) {
  return Math.max(MIN_SIZE, value);
}

function computeScaledBounds(orig, scaleX, scaleY, handle) {
  let width = clampSize(orig.width * scaleX);
  let height = clampSize(orig.height * scaleY);
  let pdfX = orig.pdfX;
  let pdfY = orig.pdfY;

  if (handle.includes('w') && !handle.includes('e')) {
    pdfX = orig.pdfX + (orig.width - width);
  } else if (!handle.includes('w') && !handle.includes('e')) {
    pdfX = orig.pdfX + (orig.width - width) / 2;
  }

  if (handle.includes('n') && !handle.includes('s')) {
    pdfY = orig.pdfY + (orig.height - height);
  } else if (!handle.includes('n') && !handle.includes('s')) {
    pdfY = orig.pdfY + (orig.height - height) / 2;
  }

  return { pdfX, pdfY, width, height };
}

function applyResizeSnap(bounds, snap, handle) {
  if (!snap) return bounds;
  const dx = snap.snapX - bounds.pdfX;
  const dy = snap.snapY - bounds.pdfY;
  let next = { ...bounds };

  if (handle.includes('e')) {
    next.width = clampSize(next.width + dx);
  } else if (handle.includes('w')) {
    next.pdfX += dx;
    next.width = clampSize(next.width - dx);
  } else {
    next.pdfX += dx;
  }

  if (handle.includes('n')) {
    next.height = clampSize(next.height + dy);
  } else if (handle.includes('s')) {
    next.pdfY += dy;
    next.height = clampSize(next.height - dy);
  } else {
    next.pdfY += dy;
  }

  return next;
}

export function startDrag(selection, renderObjects, pos) {
  const origPositions = {};
  for (const id of selection) {
    const item = renderObjects.find(current => current.id === id);
    if (item) {
      origPositions[id] = {
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        width: item.width,
        height: item.height,
        transform: item.transform ?? null,
      };
    }
  }
  return {
    mode: 'drag',
    startPoint: pos,
    dragObjectIds: [...selection],
    dragOrigPositions: origPositions,
    dragPreview: null,
    lassoRect: null,
  };
}

export function updateDrag({
  interactionState,
  pos,
  zoom,
  renderObjects,
  pdfPageWidth,
  pdfPageHeight,
  setSnapGuides,
}) {
  const dx = (pos.x - interactionState.startPoint.x) / zoom;
  const dy = (pos.y - interactionState.startPoint.y) / zoom;
  const primaryId = interactionState.dragObjectIds[0];
  const primary = interactionState.dragOrigPositions[primaryId];
  if (!primary) return null;

  const otherObjects = renderObjects.filter(o => !interactionState.dragObjectIds.includes(o.id));
  const candidateX = primary.pdfX + dx;
  const candidateY = primary.pdfY - dy;
  const snap = snapPosition(candidateX, candidateY, primary.width, primary.height, otherObjects, zoom, pdfPageWidth, pdfPageHeight);
  const snappedDx = snap.snapX - primary.pdfX;
  const snappedDy = snap.snapY - primary.pdfY;
  setSnapGuides(snapGuidesToScreen(snap.guides, zoom, pdfPageHeight));

  const preview = new Map();
  for (const id of interactionState.dragObjectIds) {
    const orig = interactionState.dragOrigPositions[id];
    if (!orig) continue;
    preview.set(id, {
      pdfX: orig.pdfX + snappedDx,
      pdfY: orig.pdfY + snappedDy,
    });
  }
  return preview;
}

export function endDrag(interactionState) {
  if (!interactionState.dragPreview) return [];
  const patches = [];
  for (const [id, next] of interactionState.dragPreview.entries()) {
    patches.push({ id, pdfX: next.pdfX, pdfY: next.pdfY });
  }
  return patches;
}

export function startResize(selectionBounds, selectionScreen, selectedObjects, pos, handle) {
  const origPositions = new Map();
  for (const obj of selectedObjects) {
    origPositions.set(obj.id, {
      pdfX: obj.pdfX,
      pdfY: obj.pdfY,
      width: obj.width,
      height: obj.height,
      transform: obj.transform ?? null,
    });
  }
  return {
    mode: 'resize',
    startPoint: pos,
    resizeHandle: handle,
    resizeScreenBounds: selectionScreen,
    resizePdfBounds: selectionBounds,
    resizeOrigPositions: origPositions,
    dragPreview: null,
  };
}

export function updateResize({
  interactionState,
  pos,
  screenRectToPdf,
  renderObjects,
  pdfPageWidth,
  pdfPageHeight,
  zoom,
  shiftKey,
  setSnapGuides,
}) {
  const bounds = interactionState.resizeScreenBounds;
  const dx = pos.x - interactionState.startPoint.x;
  const dy = pos.y - interactionState.startPoint.y;
  let left = bounds.left;
  let top = bounds.top;
  let width = bounds.width;
  let height = bounds.height;

  const handle = interactionState.resizeHandle;
  if (handle.includes('e')) width = clampSize(bounds.width + dx);
  if (handle.includes('s')) height = clampSize(bounds.height + dy);
  if (handle.includes('w')) {
    width = clampSize(bounds.width - dx);
    left = bounds.left + dx;
  }
  if (handle.includes('n')) {
    height = clampSize(bounds.height - dy);
    top = bounds.top + dy;
  }

  let newPdfBounds = screenRectToPdf(left, top, width, height);
  const orig = interactionState.resizePdfBounds;
  const baseWidth = orig.width || 1;
  const baseHeight = orig.height || 1;
  let scaleX = newPdfBounds.width / baseWidth;
  let scaleY = newPdfBounds.height / baseHeight;

  if (shiftKey) {
    const uniform = Math.max(Math.abs(scaleX), Math.abs(scaleY)) || 1;
    scaleX = uniform;
    scaleY = uniform;
    newPdfBounds = computeScaledBounds(orig, scaleX, scaleY, handle);
  }

  const otherObjects = renderObjects.filter(o => !interactionState.resizeOrigPositions?.has(o.id));
  const snap = snapPosition(newPdfBounds.pdfX, newPdfBounds.pdfY, newPdfBounds.width, newPdfBounds.height, otherObjects, zoom, pdfPageWidth, pdfPageHeight);
  setSnapGuides(snapGuidesToScreen(snap.guides, zoom, pdfPageHeight));
  const snappedBounds = applyResizeSnap(newPdfBounds, snap, handle);

  const preview = new Map();
  for (const [id, obj] of interactionState.resizeOrigPositions.entries()) {
    const relX = obj.pdfX - orig.pdfX;
    const relY = obj.pdfY - orig.pdfY;
    const nextScaleX = snappedBounds.width / baseWidth;
    const nextScaleY = snappedBounds.height / baseHeight;
    preview.set(id, {
      pdfX: snappedBounds.pdfX + relX * nextScaleX,
      pdfY: snappedBounds.pdfY + relY * nextScaleY,
      width: obj.width * nextScaleX,
      height: obj.height * nextScaleY,
      transform: obj.transform ?? null,
    });
  }
  return preview;
}

export function endResize(interactionState) {
  if (!interactionState.dragPreview) return [];
  const patches = [];
  for (const [id, next] of interactionState.dragPreview.entries()) {
    patches.push({ id, pdfX: next.pdfX, pdfY: next.pdfY, width: next.width, height: next.height });
  }
  return patches;
}

export function startRotate(selectionBounds, selectedObjects, pos) {
  const cx = selectionBounds.pdfX + selectionBounds.width / 2;
  const cy = selectionBounds.pdfY + selectionBounds.height / 2;
  const origPositions = new Map();
  for (const obj of selectedObjects) {
    origPositions.set(obj.id, {
      pdfX: obj.pdfX,
      pdfY: obj.pdfY,
      width: obj.width,
      height: obj.height,
      transform: obj.transform ?? null,
    });
  }
  const startAngle = Math.atan2(pos.y - cy, pos.x - cx);
  return {
    mode: 'rotate',
    rotateCenter: { x: cx, y: cy },
    rotateStartAngle: startAngle,
    rotateOrigPositions: origPositions,
    dragPreview: null,
  };
}

export function updateRotate({ interactionState, pos, shiftKey }) {
  const center = interactionState.rotateCenter;
  if (!center) return null;
  const currentAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
  let deltaRad = currentAngle - interactionState.rotateStartAngle;
  if (shiftKey) {
    const step = Math.PI / 12;
    deltaRad = Math.round(deltaRad / step) * step;
  }
  const deltaDeg = (deltaRad * 180) / Math.PI;
  const preview = new Map();
  for (const [id, obj] of interactionState.rotateOrigPositions.entries()) {
    const cx = obj.pdfX + obj.width / 2;
    const cy = obj.pdfY + obj.height / 2;
    const relX = cx - center.x;
    const relY = cy - center.y;
    const cos = Math.cos(deltaRad);
    const sin = Math.sin(deltaRad);
    const nextCx = center.x + relX * cos - relY * sin;
    const nextCy = center.y + relX * sin + relY * cos;
    const nextPdfX = nextCx - obj.width / 2;
    const nextPdfY = nextCy - obj.height / 2;
    preview.set(id, {
      pdfX: nextPdfX,
      pdfY: nextPdfY,
      transform: {
        ...(obj.transform ?? { scaleX: 1, scaleY: 1, rotation: 0 }),
        rotation: ((obj.transform?.rotation ?? 0) + deltaDeg),
      },
    });
  }
  return preview;
}

export function endRotate(interactionState) {
  if (!interactionState.dragPreview) return [];
  const patches = [];
  for (const [id, next] of interactionState.dragPreview.entries()) {
    patches.push({ id, pdfX: next.pdfX, pdfY: next.pdfY, transform: next.transform });
  }
  return patches;
}
