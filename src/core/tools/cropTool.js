export function createCropTool(ctx) {
  const { setCropRect, cropStartRef, setInteractionState } = ctx;

  return {
    onMouseDown(_e, pos) {
      cropStartRef.current = pos;
      setInteractionState(prev => ({ ...prev, cropStart: pos }));
      setCropRect({ x: pos.x, y: pos.y, width: 1, height: 1 });
    },

    onMouseMove(_e, pos) {
      const start = cropStartRef.current;
      if (!start) return;
      setCropRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y),
      });
    },

    onMouseUp() {
      cropStartRef.current = null;
      setInteractionState(prev => ({ ...prev, cropStart: null }));
      // Crop is applied via the overlay action buttons.
    },
    onCancel() {
      cropStartRef.current = null;
      setInteractionState(prev => ({ ...prev, cropStart: null }));
      setCropRect(null);
    },
  };
}
