import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateTableOfContents(sections, pageOffsets) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  page.drawText('TABLE OF CONTENTS', {
    x: 200,
    y: 720,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  let y = 680;
  for (const section of sections) {
    if (!section.enabled) continue;
    const pageNum = pageOffsets[section.id] ?? '--';
    const label = section.label;
    const dots = '.'.repeat(Math.max(3, 55 - label.length));

    page.drawText(label, { x: 60, y, size: 11, font });
    page.drawText(dots, {
      x: 70 + font.widthOfTextAtSize(label, 11),
      y,
      size: 11,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });
    page.drawText(String(pageNum), { x: 530, y, size: 11, font });

    y -= 22;
    if (y < 80) break;
  }

  return pdfDoc.save();
}
