export function createCropTool(ctx) {
  const { setCropStart, setCropRect, cropStart } = ctx;

  return {
    onMouseDown(_e, pos) {
      setCropStart({ x: pos.x, y: pos.y });
      setCropRect(null);
    },

    onMouseMove(_e, pos) {
      if (!cropStart) return;
      setCropRect({
        x: Math.min(cropStart.x, pos.x),
        y: Math.min(cropStart.y, pos.y),
        width: Math.abs(pos.x - cropStart.x),
        height: Math.abs(pos.y - cropStart.y),
      });
    },

    onMouseUp() {
      // Crop is applied via the overlay action buttons.
    },
  };
}
