export function createTextTool(ctx) {
  const {
    setTextBoxStart, setTextBoxRect, textBoxStart, textBoxRect,
    setTextInput,
  } = ctx;

  return {
    onMouseDown(_e, pos) {
      setTextBoxStart({ x: pos.x, y: pos.y });
      setTextBoxRect(null);
    },

    onMouseMove(_e, pos) {
      if (!textBoxStart) return;
      setTextBoxRect({
        x: Math.min(textBoxStart.x, pos.x),
        y: Math.min(textBoxStart.y, pos.y),
        width: Math.abs(pos.x - textBoxStart.x),
        height: Math.abs(pos.y - textBoxStart.y),
      });
    },

    onMouseUp() {
      if (textBoxRect && textBoxRect.width > 5 && textBoxRect.height > 5) {
        setTextInput({
          x: textBoxRect.x,
          y: textBoxRect.y,
          width: textBoxRect.width,
          height: textBoxRect.height,
          text: '',
          fontSize: 16,
        });
        setTextBoxRect(null);
      }
      setTextBoxStart(null);
    },
    onCancel() {
      setTextBoxRect(null);
      setTextBoxStart(null);
    },
  };
}
