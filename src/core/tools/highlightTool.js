import { createHighlightObject } from '../../engine/DocumentModel';

export function createHighlightTool(ctx) {
  const {
    setHighlightStart, setHighlightRect, highlightStart, highlightRect,
    screenRectToPdf, onAddObject, createBaseObject,
    toolDefaults,
  } = ctx;

  return {
    onMouseDown(_e, pos) {
      setHighlightStart({ x: pos.x, y: pos.y });
      setHighlightRect(null);
    },

    onMouseMove(_e, pos) {
      if (!highlightStart) return;
      setHighlightRect({
        x: Math.min(highlightStart.x, pos.x),
        y: Math.min(highlightStart.y, pos.y),
        width: Math.abs(pos.x - highlightStart.x),
        height: Math.abs(pos.y - highlightStart.y),
      });
    },

    onMouseUp() {
      if (highlightRect && highlightRect.width > 5 && highlightRect.height > 5) {
        const rect = screenRectToPdf(highlightRect.x, highlightRect.y, highlightRect.width, highlightRect.height);
        onAddObject(createHighlightObject(createBaseObject('highlight', rect, 'annotations', {
          color: toolDefaults.highlight?.color || '#c9a84c',
          opacity: toolDefaults.highlight?.opacity || 0.35,
        })));
        setHighlightRect(null);
      }
      setHighlightStart(null);
    },
    onCancel() {
      setHighlightRect(null);
      setHighlightStart(null);
    },
  };
}
