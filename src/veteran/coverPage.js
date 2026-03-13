import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateCoverPage(profile, packetType, claimSummary) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(0.13, 0.13, 0.22),
  });

  page.drawText('VETERAN EVIDENCE PACKET', {
    x: 40,
    y: height - 52,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const info = [
    ['Veteran Name:', `${profile.member.firstName} ${profile.member.lastName}`.trim()],
    ['Service Branch:', profile.member.branch],
    ['Pay Grade:', `${profile.member.rank} / ${profile.member.payGrade}`.trim()],
    ['Claim Type:', packetType],
    ['Date Prepared:', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Prepared By:', profile.member.fullName],
  ];

  let y = height - 160;
  for (const [label, value] of info) {
    page.drawText(label, { x: 60, y, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(value || '', { x: 200, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 22;
  }
  if (claimSummary) {
    y -= 20;
    page.drawRectangle({
      x: 50,
      y: y - 80,
      width: width - 100,
      height: 90,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.5,
      color: rgb(0.97, 0.97, 0.97),
    });
    page.drawText('Claim Summary:', { x: 60, y: y - 10, size: 10, font: fontBold });
    page.drawText(claimSummary.substring(0, 400), {
      x: 60,
      y: y - 28,
      size: 9,
      font,
      maxWidth: width - 120,
      lineHeight: 14,
    });
  }

  page.drawText(
    'Prepared with MilPDF - Free PDF tools for Veterans',
    { x: 40, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.5) }
  );

  return pdfDoc.save();
}
