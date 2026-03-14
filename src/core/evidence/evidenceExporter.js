import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { applyBatesNumbers } from './batesEngine';

function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function buildCoverPage(pdfDoc, title, subtitle) {
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: rgb(0.1, 0.1, 0.2),
  });

  page.drawText(title, {
    x: 50,
    y: height - 55,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(subtitle, {
    x: 50,
    y: height - 90,
    size: 12,
    font,
    color: rgb(0.8, 0.8, 0.9),
  });

  page.drawText('Prepared with MilPDF', {
    x: 50,
    y: 40,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.6),
  });
}

async function buildIndexPage(pdfDoc, exhibits, markers, startPageOffset) {
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let y = 740;

  page.drawText('Evidence Index', { x: 50, y, size: 16, font: fontBold, color: rgb(0.15, 0.15, 0.2) });
  y -= 30;

  for (const exhibit of exhibits) {
    page.drawText(exhibit.label, { x: 50, y, size: 12, font: fontBold });
    y -= 18;
    const exhibitMarkers = markers.filter(m => m.exhibitId === exhibit.id);
    for (const marker of exhibitMarkers) {
      const pageNum = marker.page + startPageOffset;
      page.drawText(`${marker.label} (p${pageNum})`, { x: 70, y, size: 10, font });
      y -= 14;
      if (y < 60) break;
    }
    y -= 8;
    if (y < 80) break;
  }
}

export async function exportEvidenceBundle({
  pdfBytes,
  exhibits,
  markers,
  batesPrefix = 'MILPDF-',
  batesStartNumber = 1,
  batesPadding = 6,
  title = 'Evidence Bundle',
} = {}) {
  const sourceDoc = await PDFDocument.load(pdfBytes);
  const bundleDoc = await PDFDocument.create();
  const date = formatDate(new Date());

  await buildCoverPage(bundleDoc, title, `Generated ${date}`);
  await buildIndexPage(bundleDoc, exhibits, markers, 2);

  const indices = Array.from({ length: sourceDoc.getPageCount() }, (_, i) => i);
  const copiedPages = await bundleDoc.copyPages(sourceDoc, indices);
  copiedPages.forEach(page => bundleDoc.addPage(page));

  await applyBatesNumbers(bundleDoc, {
    prefix: batesPrefix,
    startNumber: batesStartNumber,
    padding: batesPadding,
  });

  return bundleDoc.save();
}
