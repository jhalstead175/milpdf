import { degrees } from 'pdf-lib';

export function identityTransform() {
  return { scaleX: 1, scaleY: 1, rotation: 0 };
}

export function transformToCSS(transform) {
  const { scaleX = 1, scaleY = 1, rotation = 0 } = transform || {};
  return `scale(${scaleX}, ${scaleY}) rotate(${-rotation}deg)`;
}

export function transformToPdfLib(transform) {
  return {
    rotate: degrees(transform?.rotation ?? 0),
    xScale: transform?.scaleX ?? 1,
    yScale: transform?.scaleY ?? 1,
  };
}

export function transformedBounds(obj) {
  if (!obj?.transform?.rotation) {
    return { pdfX: obj.pdfX, pdfY: obj.pdfY, width: obj.width, height: obj.height };
  }

  const rad = (obj.transform.rotation * Math.PI) / 180;
  const cx = obj.pdfX + obj.width / 2;
  const cy = obj.pdfY + obj.height / 2;
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const corners = [
    [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
  ].map(([lx, ly]) => ({
    x: cx + lx * Math.cos(rad) - ly * Math.sin(rad),
    y: cy + lx * Math.sin(rad) + ly * Math.cos(rad),
  }));

  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  return {
    pdfX: Math.min(...xs),
    pdfY: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}