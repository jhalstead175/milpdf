export function createEditTool(ctx) {
  const {
    setEditStart, setEditRect, editStart, editRect, setEditInput,
  } = ctx;

  return {
    onMouseDown(_e, pos) {
      setEditStart({ x: pos.x, y: pos.y });
      setEditRect(null);
    },

    onMouseMove(_e, pos) {
      if (!editStart) return;
      setEditRect({
        x: Math.min(editStart.x, pos.x),
        y: Math.min(editStart.y, pos.y),
        width: Math.abs(pos.x - editStart.x),
        height: Math.abs(pos.y - editStart.y),
      });
    },

    onMouseUp() {
      if (editRect && editRect.width > 5 && editRect.height > 5) {
        setEditInput({
          x: editRect.x,
          y: editRect.y,
          width: editRect.width,
          height: editRect.height,
          text: '',
        });
        setEditRect(null);
      }
      setEditStart(null);
    },
  };
}
