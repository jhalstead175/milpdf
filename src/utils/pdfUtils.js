import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';

// Set up PDF.js worker from CDN
GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

export async function getRenderDoc(bytes) {
  const loadingTask = getDocument({
    data: bytes.slice(0),
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/cmaps/`,
    cMapPacked: true,
  });
  return loadingTask.promise;
}

export async function loadPdf(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const renderDoc = await getRenderDoc(bytes);
  return { pdfDoc, renderDoc, bytes };
}

async function refreshRender(pdfDoc) {
  const bytes = await pdfDoc.save();
  const renderDoc = await getRenderDoc(bytes);
  return { pdfDoc, bytes: new Uint8Array(bytes), renderDoc };
}

export async function renderPageToCanvas(renderDoc, pageNum, canvas, scale = 1.0) {
  const page = await renderDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}

export async function deletePage(pdfDoc, pageIndex) {
  pdfDoc.removePage(pageIndex);
  return refreshRender(pdfDoc);
}

export async function reorderPages(currentBytes, newOrder) {
  const srcDoc = await PDFDocument.load(currentBytes);
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, newOrder);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }
  const bytes = await newDoc.save();
  const renderDoc = await getRenderDoc(bytes);
  return { pdfDoc: newDoc, bytes: new Uint8Array(bytes), renderDoc };
}

export async function rotatePage(pdfDoc, pageIndex, angle) {
  const page = pdfDoc.getPages()[pageIndex];
  const current = page.getRotation().angle;
  page.setRotation(degrees(current + angle));
  return refreshRender(pdfDoc);
}

export async function addBlankPage(pdfDoc, atIndex) {
  if (atIndex !== undefined && atIndex >= 0) {
    pdfDoc.insertPage(atIndex);
  } else {
    pdfDoc.addPage();
  }
  return refreshRender(pdfDoc);
}

export async function mergePdf(pdfDoc, otherArrayBuffer) {
  const otherDoc = await PDFDocument.load(new Uint8Array(otherArrayBuffer));
  const count = otherDoc.getPageCount();
  const indices = Array.from({ length: count }, (_, i) => i);
  const copiedPages = await pdfDoc.copyPages(otherDoc, indices);
  for (const page of copiedPages) {
    pdfDoc.addPage(page);
  }
  return refreshRender(pdfDoc);
}

export async function embedAnnotations(currentBytes, annotations) {
  const pdfDoc = await PDFDocument.load(currentBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const pageIndex = ann.pageNum - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const pageHeight = page.getHeight();
    const scale = ann.scale || 1;

    if (ann.type === 'text') {
      const pdfX = ann.x / scale;
      const pdfY = pageHeight - (ann.y / scale) - (ann.fontSize || 16);
      page.drawText(ann.text, {
        x: pdfX,
        y: pdfY,
        size: ann.fontSize || 16,
        font,
        color: rgb(0, 0, 0),
      });
    } else if (ann.type === 'signature') {
      const pngBytes = await fetch(ann.dataUrl).then(r => r.arrayBuffer());
      const image = await pdfDoc.embedPng(pngBytes);
      const w = ann.width / scale;
      const h = ann.height / scale;
      const pdfX = ann.x / scale;
      const pdfY = pageHeight - (ann.y / scale) - h;
      page.drawImage(image, { x: pdfX, y: pdfY, width: w, height: h });
    } else if (ann.type === 'highlight') {
      const pdfX = ann.x / scale;
      const pdfW = ann.width / scale;
      const pdfH = ann.height / scale;
      const pdfY = pageHeight - (ann.y / scale) - pdfH;
      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: pdfW,
        height: pdfH,
        color: rgb(1, 0.92, 0.23),
        opacity: 0.35,
      });
    } else if (ann.type === 'redact') {
      const pdfX = ann.x / scale;
      const pdfW = ann.width / scale;
      const pdfH = ann.height / scale;
      const pdfY = pageHeight - (ann.y / scale) - pdfH;
      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: pdfW,
        height: pdfH,
        color: rgb(0, 0, 0),
        opacity: 1,
      });
    } else if (ann.type === 'whiteout') {
      const pdfX = ann.x / scale;
      const pdfW = ann.width / scale;
      const pdfH = ann.height / scale;
      const pdfY = pageHeight - (ann.y / scale) - pdfH;
      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: pdfW,
        height: pdfH,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
    } else if (ann.type === 'drawing') {
      // Freehand drawings: draw as a series of tiny lines
      const points = ann.points || [];
      for (let i = 1; i < points.length; i++) {
        const x1 = points[i - 1].x / scale;
        const y1 = pageHeight - (points[i - 1].y / scale);
        const x2 = points[i].x / scale;
        const y2 = pageHeight - (points[i].y / scale);
        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness: ann.lineWidth || 2,
          color: rgb(
            ...(ann.color === '#f38ba8' ? [0.95, 0.55, 0.66] :
                ann.color === '#89b4fa' ? [0.54, 0.71, 0.98] :
                [0, 0, 0])
          ),
        });
      }
    }
  }

  return pdfDoc.save();
}

export async function cropPage(pdfDoc, pageIndex, cropBox) {
  const page = pdfDoc.getPages()[pageIndex];
  const pageHeight = page.getHeight();
  const scale = cropBox.scale || 1;
  const x = cropBox.x / scale;
  const y = cropBox.y / scale;
  const w = cropBox.width / scale;
  const h = cropBox.height / scale;
  // PDF origin is bottom-left
  const pdfX = x;
  const pdfY = pageHeight - y - h;
  page.setCropBox(pdfX, pdfY, w, h);
  return refreshRender(pdfDoc);
}

export function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function addWatermark(currentBytes, text) {
  const pdfDoc = await PDFDocument.load(currentBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.min(width, height) / 6;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.3,
      rotate: degrees(45),
    });
  }
  return pdfDoc.save();
}

export async function splitPdf(currentBytes, fromPage, toPage) {
  const srcDoc = await PDFDocument.load(currentBytes);
  const newDoc = await PDFDocument.create();
  const indices = [];
  for (let i = fromPage - 1; i < toPage; i++) indices.push(i);
  const copiedPages = await newDoc.copyPages(srcDoc, indices);
  for (const page of copiedPages) newDoc.addPage(page);
  return newDoc.save();
}

export function printPdf(bytes) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
}
