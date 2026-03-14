import { transformedBounds } from '../../editor/Transform';
import {
  startDrag,
  updateDrag,
  endDrag,
  updateResize,
  endResize,
  updateRotate,
  endRotate,
} from '../transform';

export function createSelectTool(ctx) {
  const {
    selection, setSelection, onSelectionChange,
    findObjectAt, renderObjects, layers,
    interactionState, setInteractionState, setSnapGuides,
    zoom, pdfPageHeight, pdfPageWidth, screenRectToPdf, screenToPdfPoint,
    onBatchUpdateObjects,
  } = ctx;

  return {
    onMouseDown(e, pos) {
      const obj = findObjectAt(pos);
      if (obj) {
        if (e.shiftKey) {
          const next = new Set(selection);
          next.has(obj.id) ? next.delete(obj.id) : next.add(obj.id);
          setSelection(next);
          if (onSelectionChange) onSelectionChange([...next]);
          return;
        }

        const next = selection.has(obj.id) ? selection : new Set([obj.id]);
        setSelection(next);
        if (onSelectionChange) onSelectionChange([...next]);
        const dragIds = [...next].filter(id => {
          const item = renderObjects.find(current => current.id === id);
          if (!item) return false;
          if (item.locked) return false;
          if (layers?.[item.layerId]?.locked) return false;
          return true;
        });
        if (dragIds.length === 0) return;
        const nextState = startDrag(dragIds, renderObjects, pos);
        setInteractionState(prev => ({ ...prev, ...nextState }));
        return;
      }

      if (!e.shiftKey) {
        setSelection(new Set());
        if (onSelectionChange) onSelectionChange([]);
      }
      setInteractionState(prev => ({
        ...prev,
        mode: 'lasso',
        startPoint: pos,
        lassoRect: { startX: pos.x, startY: pos.y, x: pos.x, y: pos.y, width: 0, height: 0 },
      }));
    },

    onMouseMove(e, pos) {
      if (interactionState.mode === 'resize' && interactionState.resizeScreenBounds && interactionState.resizePdfBounds && interactionState.resizeOrigPositions) {
        const preview = updateResize({
          interactionState,
          pos,
          screenRectToPdf,
          renderObjects,
          pdfPageWidth,
          pdfPageHeight,
          zoom,
          shiftKey: e.shiftKey,
          setSnapGuides,
        });
        setInteractionState(prev => ({ ...prev, dragPreview: preview }));
        return;
      }

      if (interactionState.mode === 'drag' && interactionState.dragOrigPositions) {
        const preview = updateDrag({
          interactionState,
          pos,
          zoom,
          renderObjects,
          pdfPageWidth,
          pdfPageHeight,
          setSnapGuides,
        });
        setInteractionState(prev => ({ ...prev, dragPreview: preview }));
        return;
      }

      if (interactionState.mode === 'rotate' && interactionState.rotateCenter && interactionState.rotateOrigPositions) {
        const pdfPos = screenToPdfPoint(pos.x, pos.y);
        const preview = updateRotate({ interactionState, pos: pdfPos, shiftKey: e.shiftKey });
        setInteractionState(prev => ({ ...prev, dragPreview: preview }));
        return;
      }

      if (interactionState.mode === 'lasso' && interactionState.lassoRect) {
        const lassoRect = interactionState.lassoRect;
        setInteractionState(prev => ({
          ...prev,
          lassoRect: {
            startX: lassoRect.startX,
            startY: lassoRect.startY,
            x: Math.min(lassoRect.startX, pos.x),
            y: Math.min(lassoRect.startY, pos.y),
            width: Math.abs(pos.x - lassoRect.startX),
            height: Math.abs(pos.y - lassoRect.startY),
          },
        }));
      }
    },

    onMouseUp() {
      if (interactionState.mode === 'resize') {
        const patches = endResize(interactionState);
        if (patches.length > 0 && onBatchUpdateObjects) onBatchUpdateObjects(patches);
        setInteractionState(prev => ({
          ...prev,
          mode: null,
          startPoint: null,
          resizeHandle: null,
          resizeScreenBounds: null,
          resizePdfBounds: null,
          resizeOrigPositions: null,
          dragPreview: null,
        }));
        setSnapGuides([]);
        return;
      }

      if (interactionState.mode === 'drag') {
        const patches = endDrag(interactionState);
        if (patches.length > 0 && onBatchUpdateObjects) onBatchUpdateObjects(patches);
        setInteractionState(prev => ({
          ...prev,
          mode: null,
          startPoint: null,
          dragObjectIds: [],
          dragOrigPositions: null,
          dragPreview: null,
        }));
        setSnapGuides([]);
      }

      if (interactionState.mode === 'rotate') {
        const patches = endRotate(interactionState);
        if (patches.length > 0 && onBatchUpdateObjects) onBatchUpdateObjects(patches);
        setInteractionState(prev => ({
          ...prev,
          mode: null,
          rotateCenter: null,
          rotateStartAngle: null,
          rotateOrigPositions: null,
          dragPreview: null,
        }));
        setSnapGuides([]);
      }

      if (interactionState.mode === 'lasso' && interactionState.lassoRect && interactionState.lassoRect.width > 4 && interactionState.lassoRect.height > 4) {
        const lassoRect = interactionState.lassoRect;
        const rect = screenRectToPdf(lassoRect.x, lassoRect.y, lassoRect.width, lassoRect.height);
        const hits = renderObjects.filter(obj => {
          if (obj.locked) return false;
          if (layers?.[obj.layerId]?.locked) return false;
          const bounds = transformedBounds(obj);
          return (
            bounds.pdfX < rect.pdfX + rect.width &&
            bounds.pdfX + bounds.width > rect.pdfX &&
            bounds.pdfY < rect.pdfY + rect.height &&
            bounds.pdfY + bounds.height > rect.pdfY
          );
        });
        const next = new Set(hits.map(o => o.id));
        setSelection(next);
        if (onSelectionChange) onSelectionChange([...next]);
      }
      if (interactionState.mode === 'lasso') {
        setInteractionState(prev => ({
          ...prev,
          mode: null,
          startPoint: null,
          lassoRect: null,
        }));
      }
    },
  };
}
