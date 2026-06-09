// Render projection — Model → render instructions → UI.
//
// The breakthrough: the UI is no longer the truth. The model is. This function
// turns a page into a flat, z-ordered list of draw instructions. The same kind
// of descriptor list will feed BOTH the screen renderer and (eventually) the
// pdf-lib exporter, so what you see is what you export — derived from one model,
// never three peers kept in sync by hand.

export function buildRenderList(page) {
  if (!page) return [];

  return [...page.objects]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((obj) => {
      if (obj.type === 'text') {
        return {
          id: obj.id,
          type: 'text',
          x: obj.pdfX,
          y: obj.pdfY,
          width: obj.width,
          height: obj.height,
          text: obj.text,
          fontSize: obj.fontSize,
          fontFamily: obj.fontFamily,
          fontWeight: obj.fontWeight,
          fontStyle: obj.fontStyle,
          color: obj.color,
          alignment: obj.alignment,
          opacity: obj.opacity,
        };
      }

      if (obj.type === 'rect' || obj.type === 'redaction' || obj.type === 'highlight') {
        return {
          id: obj.id,
          type: obj.type,
          x: obj.pdfX,
          y: obj.pdfY,
          width: obj.width,
          height: obj.height,
          color: obj.color,
          opacity: obj.opacity,
        };
      }

      if (obj.type === 'drawing') {
        return {
          id: obj.id,
          type: 'drawing',
          points: obj.pdfPoints || obj.points || [],
          color: obj.color,
          lineWidth: obj.lineWidth,
        };
      }

      if (obj.type === 'image' || obj.type === 'signature') {
        return {
          id: obj.id,
          type: obj.type,
          x: obj.pdfX,
          y: obj.pdfY,
          width: obj.width,
          height: obj.height,
          dataUrl: obj.dataUrl,
          opacity: obj.opacity,
        };
      }

      return null;
    })
    .filter(Boolean);
}
