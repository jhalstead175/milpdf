export function layoutText(text, font, fontSize, maxWidth) {
  const lines = [];
  const paragraphs = String(text ?? '').split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const w = font.widthOfTextAtSize(candidate, fontSize);
      if (w > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

export function drawTextBox(page, obj, font, options = {}) {
  const lineHeight = obj.fontSize * (obj.lineHeight ?? 1.2);
  const lines = layoutText(obj.text, font, obj.fontSize, obj.width);

  lines.forEach((line, i) => {
    const y = (obj.pdfY + obj.height) - obj.fontSize - (i * lineHeight);
    if (!obj.autoHeight && y < obj.pdfY) return;

    let x = obj.pdfX;
    if (obj.alignment === 'center') {
      x += (obj.width - font.widthOfTextAtSize(line, obj.fontSize)) / 2;
    } else if (obj.alignment === 'right') {
      x += obj.width - font.widthOfTextAtSize(line, obj.fontSize);
    }

    page.drawText(line, {
      x,
      y,
      size: obj.fontSize,
      font,
      color: options.color,
      rotate: options.rotate,
    });
  });
}