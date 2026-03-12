import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function convertPdfToWord(renderDoc, filename = 'converted.docx') {
  const numPages = renderDoc.numPages;
  const sections = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await renderDoc.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by line (based on y-coordinate)
    const lines = {};
    for (const item of textContent.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (!lines[y]) lines[y] = [];
      lines[y].push({ text: item.str, x: item.transform[4] });
    }

    // Sort lines by y descending (PDF bottom-left origin → top-to-bottom reading order)
    const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);

    const paragraphs = sortedYs.map(y => {
      const lineItems = lines[y].sort((a, b) => a.x - b.x);
      const text = lineItems.map(item => item.text).join('');
      return new Paragraph({
        children: [new TextRun({ text, size: 24 })],
      });
    });

    if (paragraphs.length === 0) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
    }

    sections.push({ properties: {}, children: paragraphs });
  }

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
