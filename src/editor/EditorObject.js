/**
 * EditorObject — MilPDF 2.0 object model
 *
 * All positions/dimensions are stored in PDF coordinate space:
 *   - Origin: bottom-left of page
 *   - Units: PDF points (1 pt = 1/72 inch)
 *   - pdfX: distance from left edge
 *   - pdfY: distance from bottom edge
 *
 * This makes embed-time trivial — no coordinate conversion at save.
 */

let _seq = Date.now();
export function generateId() {
  return ++_seq;
}

function base(type, page, pdfX, pdfY, width, height, extra = {}) {
  return {
    id: generateId(),
    type,
    page,      // 1-indexed page number
    pdfX,      // PDF points from left
    pdfY,      // PDF points from bottom
    width,     // PDF points
    height,    // PDF points
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    name: type,
    opacity: 1,
    ...extra,
  };
}

export function createTextObject(page, pdfX, pdfY, text, fontSize = 16) {
  return base('text', page, pdfX, pdfY, 0, fontSize, {
    text,
    fontSize,
    alignment: 'left',
    lineHeight: 1.2,
    color: '#000000',
  });
}

export function createHighlightObject(page, pdfX, pdfY, width, height) {
  return base('highlight', page, pdfX, pdfY, width, height, {
    color: '#ffec3b',
    opacity: 0.35,
  });
}

export function createRedactObject(page, pdfX, pdfY, width, height) {
  return base('redact', page, pdfX, pdfY, width, height, {});
}

export function createWhiteoutObject(page, pdfX, pdfY, width, height) {
  return base('whiteout', page, pdfX, pdfY, width, height, {});
}

export function createSignatureObject(page, pdfX, pdfY, width, height, dataUrl) {
  return base('signature', page, pdfX, pdfY, width, height, { dataUrl });
}

export function createDrawingObject(page, pdfPoints, color = '#000000', lineWidth = 2) {
  const xs = pdfPoints.map(p => p.x);
  const ys = pdfPoints.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return base('drawing', page, minX, minY, maxX - minX, maxY - minY, {
    pdfPoints,
    color,
    lineWidth,
  });
}

/**
 * Migration: convert a legacy annotation (screen-space) to EditorObject (PDF-space).
 * pageHeight: the PDF page height in points for the relevant page.
 */
export function fromLegacyAnnotation(ann, pageHeight) {
  const scale = ann.scale || 1;
  const pdfX = ann.x / scale;

  switch (ann.type) {
    case 'text': {
      const fontSize = ann.fontSize || 16;
      const pdfY = pageHeight - (ann.y / scale) - fontSize;
      return {
        id: ann.id,
        type: 'text',
        page: ann.pageNum,
        pdfX,
        pdfY,
        width: 0,
        height: fontSize,
        rotation: 0,
        zIndex: 0,
        locked: false,
        visible: true,
        name: 'text',
        opacity: 1,
        text: ann.text,
        fontSize,
        alignment: 'left',
        lineHeight: 1.2,
        color: '#000000',
      };
    }
    case 'highlight':
    case 'redact':
    case 'whiteout': {
      const pdfW = ann.width / scale;
      const pdfH = ann.height / scale;
      const pdfY = pageHeight - (ann.y / scale) - pdfH;
      return {
        id: ann.id,
        type: ann.type,
        page: ann.pageNum,
        pdfX,
        pdfY,
        width: pdfW,
        height: pdfH,
        rotation: 0,
        zIndex: 0,
        locked: false,
        visible: true,
        name: ann.type,
        opacity: 1,
      };
    }
    case 'signature': {
      const pdfW = ann.width / scale;
      const pdfH = ann.height / scale;
      const pdfY = pageHeight - (ann.y / scale) - pdfH;
      return {
        id: ann.id,
        type: 'signature',
        page: ann.pageNum,
        pdfX,
        pdfY,
        width: pdfW,
        height: pdfH,
        rotation: 0,
        zIndex: 0,
        locked: false,
        visible: true,
        name: 'signature',
        opacity: 1,
        dataUrl: ann.dataUrl,
      };
    }
    case 'drawing': {
      const pdfPoints = (ann.points || []).map(p => ({
        x: p.x / scale,
        y: pageHeight - (p.y / scale),
      }));
      const xs = pdfPoints.map(p => p.x);
      const ys = pdfPoints.map(p => p.y);
      return {
        id: ann.id,
        type: 'drawing',
        page: ann.pageNum,
        pdfX: Math.min(...xs),
        pdfY: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        rotation: 0,
        zIndex: 0,
        locked: false,
        visible: true,
        name: 'drawing',
        opacity: 1,
        pdfPoints,
        color: ann.color || '#000000',
        lineWidth: ann.lineWidth || 2,
      };
    }
    default:
      return null;
  }
}

/**
 * Detect whether an array contains legacy annotations or new EditorObjects.
 * Legacy annotations have { x, y, scale, pageNum }.
 * EditorObjects have { pdfX, pdfY, page }.
 */
export function isLegacyFormat(objects) {
  if (!objects || objects.length === 0) return false;
  return 'pageNum' in objects[0] && !('pdfX' in objects[0]);
}
