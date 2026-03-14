export function createCropTool(ctx) {
  const { setCropStart, setCropRect, interactionState, setInteractionState } = ctx;

  return {
    onMouseDown(_e, pos) {
      setCropStart({ x: pos.x, y: pos.y });
      setInteractionState(prev => ({ ...prev, cropStart: pos }));
      setCropRect({ x: pos.x, y: pos.y, width: 1, height: 1 });
    },

    onMouseMove(_e, pos) {
      const start = interactionState.cropStart;
      if (!start) return;
      setCropRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y),
      });
    },

    onMouseUp() {
      setInteractionState(prev => ({ ...prev, cropStart: null }));
      // Crop is applied via the overlay action buttons.
    },
    onCancel() {
      setInteractionState(prev => ({ ...prev, cropStart: null }));
      setCropRect(null);
      setCropStart(null);
    },
  };
}
