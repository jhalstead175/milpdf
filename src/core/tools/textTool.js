export function createTextTool(ctx) {
  const {
    setTextBoxStart, setTextBoxRect, textBoxStart, textBoxRect,
    setTextInput, textInput,
    toolDefaults,
  } = ctx;

  return {
    onMouseDown(_e, pos) {
      if (textInput) return; // let blur on the open text box handle submit
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
      const w = textBoxRect?.width ?? 0;
      const h = textBoxRect?.height ?? 0;
      const fontSize = toolDefaults.text?.fontSize || 16;

      if (w > 10 && h > 10) {
        // Dragged — use the drawn rectangle
        setTextInput({
          x: textBoxRect.x,
          y: textBoxRect.y,
          width: textBoxRect.width,
          height: textBoxRect.height,
          text: '',
          fontSize,
          fontFamily: toolDefaults.text?.fontFamily || 'Helvetica',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: toolDefaults.text?.color || '#000000',
          alignment: 'left',
        });
      } else if (textBoxStart) {
        // Single click — place a default-size text box at the click point
        const defaultW = 200;
        const defaultH = Math.max(40, fontSize * 2 + 8);
        setTextInput({
          x: textBoxStart.x,
          y: textBoxStart.y,
          width: defaultW,
          height: defaultH,
          text: '',
          fontSize,
          fontFamily: toolDefaults.text?.fontFamily || 'Helvetica',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: toolDefaults.text?.color || '#000000',
          alignment: 'left',
        });
      }
      setTextBoxRect(null);
      setTextBoxStart(null);
    },
    onCancel() {
      setTextBoxRect(null);
      setTextBoxStart(null);
    },
  };
}
