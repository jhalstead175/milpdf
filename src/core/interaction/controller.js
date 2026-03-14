export function startRotate(pos, selectionScreen, obj) {
  const cx = selectionScreen.left + selectionScreen.width / 2;
  const cy = selectionScreen.top + selectionScreen.height / 2;
  const angle = Math.atan2(pos.y - cy, pos.x - cx);
  return {
    id: obj.id,
    centerX: cx,
    centerY: cy,
    startAngle: angle,
    origRotation: obj.transform?.rotation ?? 0,
  };
}

export function updateRotate(pos, rotationState, shiftKey) {
  const angle = Math.atan2(pos.y - rotationState.centerY, pos.x - rotationState.centerX);
  const delta = ((angle - rotationState.startAngle) * 180) / Math.PI;
  let newRot = rotationState.origRotation - delta;
  if (shiftKey) newRot = Math.round(newRot / 15) * 15;
  return newRot;
}

export function updateDragPreview(pos, dragState, zoom, renderObjects, snapFn, snapGuidesFn, pdfPageHeight) {
  const dx = (pos.x - dragState.startPoint.x) / zoom;
  const dy = (pos.y - dragState.startPoint.y) / zoom;
  const primaryId = dragState.dragObjectIds[0];
  const primary = dragState.dragOrigPositions[primaryId];
  if (!primary) return null;

  const otherObjects = renderObjects.filter(o => !dragState.dragObjectIds.includes(o.id));
  const candidateX = primary.pdfX + dx;
  const candidateY = primary.pdfY - dy;
  const snap = snapFn(candidateX, candidateY, primary.width, primary.height, otherObjects, zoom);
  const snappedDx = snap.snapX - primary.pdfX;
  const snappedDy = snap.snapY - primary.pdfY;
  snapGuidesFn(snap.guides, zoom, pdfPageHeight);

  const preview = new Map();
  for (const id of dragState.dragObjectIds) {
    const orig = dragState.dragOrigPositions[id];
    if (!orig) continue;
    preview.set(id, {
      pdfX: orig.pdfX + snappedDx,
      pdfY: orig.pdfY + snappedDy,
    });
  }
  return preview;
}

export function updateLassoRect(startPoint, pos) {
  return {
    startX: startPoint.x,
    startY: startPoint.y,
    x: Math.min(startPoint.x, pos.x),
    y: Math.min(startPoint.y, pos.y),
    width: Math.abs(pos.x - startPoint.x),
    height: Math.abs(pos.y - startPoint.y),
  };
}

export function updateResizePreview() {
  return null;
}
