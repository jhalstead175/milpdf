// Render a stamp (bordered, bold label + optional date) to a PNG data URL so
// it can ride the existing image-placement pipeline. Browser-only (uses canvas).
export function buildStampImage({ text = 'DRAFT', color = '#c0392b', date = false } = {}) {
  const label = (text || 'STAMP').toUpperCase();
  const scale = 3;            // supersample for crisp edges
  const fontSize = 30;
  const dateFontSize = 13;
  const padX = 20;
  const padY = 14;

  const measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `bold ${fontSize}px Arial, sans-serif`;
  const textW = measureCtx.measureText(label).width;

  let dateStr = '';
  let dateW = 0;
  if (date) {
    dateStr = new Date().toLocaleDateString();
    measureCtx.font = `${dateFontSize}px Arial, sans-serif`;
    dateW = measureCtx.measureText(dateStr).width;
  }

  const contentW = Math.max(textW, dateW);
  const w = Math.ceil(contentW + padX * 2);
  const h = Math.ceil(fontSize + (date ? dateFontSize + 6 : 0) + padY * 2);

  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // translucent fill + solid border, classic rubber-stamp look
  ctx.fillStyle = `${color}14`; // ~8% alpha (hex8)
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(2.5, 2.5, w - 5, h - 5);

  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillText(label, w / 2, padY);
  if (date) {
    ctx.font = `${dateFontSize}px Arial, sans-serif`;
    ctx.fillText(dateStr, w / 2, padY + fontSize + 5);
  }

  return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
}
