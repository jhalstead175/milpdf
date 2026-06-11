import { rgb, StandardFonts } from 'pdf-lib';

function padNumber(num, padding) {
  const str = String(num);
  return str.length >= padding ? str : `${'0'.repeat(padding - str.length)}${str}`;
}

export function buildBatesLabel(prefix, number, padding = 6) {
  return `${prefix}${padNumber(number, padding)}`;
}

// Resolve x/y for a label given a named corner/edge position.
function resolvePosition(position, { pageWidth, pageHeight, textWidth, fontSize, margin = 28 }) {
  const isTop = position.startsWith('top');
  const y = isTop ? pageHeight - margin - fontSize : margin;
  let x;
  if (position.endsWith('left')) x = margin;
  else if (position.endsWith('center')) x = (pageWidth - textWidth) / 2;
  else x = pageWidth - margin - textWidth; // right (default)
  return { x, y };
}

function drawLabels(pdfDoc, font, { fontSize, color, position }, labelFor) {
  const pages = pdfDoc.getPages();
  const total = pages.length;
  const labels = [];
  pages.forEach((page, index) => {
    const label = labelFor(index, total);
    labels.push({ pageIndex: index, label });
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const { x, y } = resolvePosition(position, { pageWidth: width, pageHeight: height, textWidth, fontSize });
    page.drawText(label, { x, y, size: fontSize, font, color });
  });
  return labels;
}

export async function applyBatesNumbers(pdfDoc, {
  prefix = 'MILPDF-',
  startNumber = 1,
  padding = 6,
  fontSize = 9,
  color = rgb(0.2, 0.2, 0.2),
  position = 'bottom-right',
} = {}) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  return drawLabels(pdfDoc, font, { fontSize, color, position }, (index) =>
    buildBatesLabel(prefix, startNumber + index, padding));
}

// Page numbering — format tokens: {n} current page, {total} page count.
export async function applyPageNumbers(pdfDoc, {
  format = 'Page {n} of {total}',
  startNumber = 1,
  fontSize = 10,
  color = rgb(0.2, 0.2, 0.2),
  position = 'bottom-center',
} = {}) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  return drawLabels(pdfDoc, font, { fontSize, color, position }, (index, total) =>
    format.replace(/\{n\}/g, String(startNumber + index)).replace(/\{total\}/g, String(total)));
}
