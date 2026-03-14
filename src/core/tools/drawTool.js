export function createDrawTool(ctx) {
  const {
    setDrawingPoints, drawingPoints,
    screenToPdfPoint, onAddObject, createBaseObject,
  } = ctx;

  return {
    onMouseDown(_e, pos) {
      setDrawingPoints([screenToPdfPoint(pos.x, pos.y)]);
    },

    onMouseMove(_e, pos) {
      if (!drawingPoints) return;
      setDrawingPoints(prev => [...prev, screenToPdfPoint(pos.x, pos.y)]);
    },

    onMouseUp() {
      if (drawingPoints && drawingPoints.length > 2) {
        const xs = drawingPoints.map(p => p.x);
        const ys = drawingPoints.map(p => p.y);
        const rect = {
          pdfX: Math.min(...xs),
          pdfY: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
        onAddObject(createBaseObject('drawing', rect, 'annotations', {
          pdfPoints: drawingPoints,
          color: '#000000',
          lineWidth: 2,
        }));
      }
      setDrawingPoints(null);
    },
    onCancel() {
      setDrawingPoints(null);
    },
  };
}
