import { rgb, StandardFonts } from 'pdf-lib';

function padNumber(num, padding) {
  const str = String(num);
  return str.length >= padding ? str : `${'0'.repeat(padding - str.length)}${str}`;
}

export function buildBatesLabel(prefix, number, padding = 6) {
  return `${prefix}${padNumber(number, padding)}`;
}

export async function applyBatesNumbers(pdfDoc, {
  prefix = 'MILPDF-',
  startNumber = 1,
  padding = 6,
  fontSize = 9,
  color = rgb(0.2, 0.2, 0.2),
} = {}) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const labels = [];
  let current = startNumber;

  pages.forEach((page, index) => {
    const label = buildBatesLabel(prefix, current, padding);
    labels.push({ pageIndex: index, label });
    current += 1;

    const { width } = page.getSize();
    page.drawText(label, {
      x: width - 120,
      y: 24,
      size: fontSize,
      font,
      color,
    });
  });

  return labels;
}
