export function createInteractionState() {
  return {
    mode: null,
    startPoint: null,
    dragObjectIds: [],
    dragOrigPositions: null,
    dragPreview: null,
    resizeHandle: null,
    resizeScreenBounds: null,
    resizePdfBounds: null,
    resizeOrigPositions: null,
    cropStart: null,
    rotateCenter: null,
    rotateStartAngle: null,
    rotateOrigPositions: null,
    lassoRect: null,
  };
}
