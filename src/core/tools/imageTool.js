export function createImageTool(ctx) {
  const {
    imagePlacement,
    imageStartRef,
    setImageRect,
    screenRectToPdf,
    onAddObject,
    createBaseObject,
    pdfPageWidth,
    pdfPageHeight,
    zoom,
    onImagePlaced,
    onImagePlacementCancel,
  } = ctx;

  const buildDefaultRect = (pos) => {
    if (!imagePlacement) return null;
    const imgW = imagePlacement.width || 200;
    const imgH = imagePlacement.height || 200;
    const maxW = pdfPageWidth * zoom * 0.7;
    const maxH = pdfPageHeight * zoom * 0.7;
    const scale = Math.min(1, maxW / imgW, maxH / imgH);
    const width = imgW * scale;
    const height = imgH * scale;
    return {
      x: pos.x - width / 2,
      y: pos.y - height / 2,
      width,
      height,
    };
  };

  return {
    onMouseDown(_e, pos) {
      if (!imagePlacement) return;
      imageStartRef.current = pos;
      setImageRect({ x: pos.x, y: pos.y, width: 1, height: 1 });
    },

    onMouseMove(_e, pos) {
      const start = imageStartRef.current;
      if (!start) return;
      setImageRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y),
      });
    },

    onMouseUp(_e, pos) {
      if (!imagePlacement) return;
      const start = imageStartRef.current;
      imageStartRef.current = null;
      setImageRect(null);

      // Compute rect directly from refs/args — never reads stale imageRect state
      let rect;
      if (start && pos) {
        const w = Math.abs(pos.x - start.x);
        const h = Math.abs(pos.y - start.y);
        if (w >= 5 && h >= 5) {
          rect = {
            x: Math.min(start.x, pos.x),
            y: Math.min(start.y, pos.y),
            width: w,
            height: h,
          };
        }
      }
      if (!rect) {
        rect = buildDefaultRect(pos || start || { x: 100, y: 100 });
      }
      if (!rect) return;

      const pdfRect = screenRectToPdf(rect.x, rect.y, rect.width, rect.height);
      onAddObject(createBaseObject('image', pdfRect, 'markup', {
        dataUrl: imagePlacement.dataUrl,
        name: imagePlacement.name || 'image',
        opacity: 1,
      }));
      onImagePlaced?.();
    },

    onCancel() {
      imageStartRef.current = null;
      setImageRect(null);
      onImagePlacementCancel?.();
    },
  };
}
