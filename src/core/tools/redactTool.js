export function createRedactTool(ctx) {
  const {
    setRedactStart, setRedactRect, redactStart, redactRect,
    screenRectToPdf, onAddObject, createBaseObject,
  } = ctx;

  return {
    onMouseDown(_e, pos) {
      setRedactStart({ x: pos.x, y: pos.y });
      setRedactRect(null);
    },

    onMouseMove(_e, pos) {
      if (!redactStart) return;
      setRedactRect({
        x: Math.min(redactStart.x, pos.x),
        y: Math.min(redactStart.y, pos.y),
        width: Math.abs(pos.x - redactStart.x),
        height: Math.abs(pos.y - redactStart.y),
      });
    },

    onMouseUp() {
      if (redactRect && redactRect.width > 5 && redactRect.height > 5) {
        const rect = screenRectToPdf(redactRect.x, redactRect.y, redactRect.width, redactRect.height);
        onAddObject(createBaseObject('redact', rect, 'annotations'));
        setRedactRect(null);
      }
      setRedactStart(null);
    },
    onCancel() {
      setRedactRect(null);
      setRedactStart(null);
    },
  };
}
