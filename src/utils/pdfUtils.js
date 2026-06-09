import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';
import { drawTextBox } from './textLayout';
import { transformToPdfLib } from '../editor/Transform';

// Set up PDF.js worker from CDN
GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

const REDACT_TYPES = new Set(['redact', 'whiteout']);

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

// Structural mutations are the only callers of refreshRender.
export const structuralOps = {
  deletePage,
  rotatePage,
  addBlankPage,
  mergePdf,
  insertPdf,
  reorderPages,
  cropPage,
};

export async function renderPageToCanvas(renderDoc, pageNum, canvas, scale = 1.0) {
  const page = await renderDoc.getPage(pageNum);
  try {
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { width: viewport.width, height: viewport.height };
  } finally {
    page.cleanup?.();
  }
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

export async function imagesToPdf(imageFiles) {
  const pdfDoc = await PDFDocument.create();
  for (const file of imageFiles) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let img;
    const name = file.name.toLowerCase();
    if (name.endsWith('.png')) {
      img = await pdfDoc.embedPng(bytes);
    } else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      img = await pdfDoc.embedJpg(bytes);
    } else {
      // For other formats (bmp, gif, webp, tiff), convert via canvas to PNG
      const blob = new Blob([bytes], { type: file.type });
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
      img = await pdfDoc.embedPng(pngBytes);
    }
    const { width: imgW, height: imgH } = img.scale(1);
    // Standard US Letter page: 8.5 x 11 inches at 72 pts/in
    const pageW = 612;
    const pageH = 792;
    const scale = Math.min(1, pageW / imgW, pageH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(img, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }
  const savedBytes = await pdfDoc.save();
  const renderDoc = await getRenderDoc(savedBytes);
  return { pdfDoc, bytes: new Uint8Array(savedBytes), renderDoc };
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

export async function insertPdf(pdfDoc, otherArrayBuffer, atIndex) {
  const otherDoc = await PDFDocument.load(new Uint8Array(otherArrayBuffer));
  const count = otherDoc.getPageCount();
  const indices = Array.from({ length: count }, (_, i) => i);
  const copiedPages = await pdfDoc.copyPages(otherDoc, indices);
  copiedPages.forEach((page, i) => {
    pdfDoc.insertPage(atIndex + i, page);
  });
  return refreshRender(pdfDoc);
}

function hexToRgbColor(hex, fallback = rgb(0, 0, 0)) {
  if (!hex || typeof hex !== 'string') return fallback;
  const raw = hex.replace('#', '').trim();
  if (raw.length !== 6) return fallback;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return fallback;
  return rgb(r, g, b);
}

function resolveFontKey(obj) {
  const family = obj.fontFamily || 'Helvetica';
  const weight = obj.fontWeight || 'normal';
  const style = obj.fontStyle || 'normal';

  if (family === 'Times-Roman') {
    if (weight === 'bold' && style === 'italic') return StandardFonts.TimesBoldItalic;
    if (weight === 'bold') return StandardFonts.TimesBold;
    if (style === 'italic') return StandardFonts.TimesItalic;
    return StandardFonts.TimesRoman;
  }

  if (family === 'Courier') {
    if (weight === 'bold' && style === 'italic') return StandardFonts.CourierBoldOblique;
    if (weight === 'bold') return StandardFonts.CourierBold;
    if (style === 'italic') return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }

  if (weight === 'bold' && style === 'italic') return StandardFonts.HelveticaBoldOblique;
  if (weight === 'bold') return StandardFonts.HelveticaBold;
  if (style === 'italic') return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

// ARCHITECTURE INVARIANT:
// embedEditorObjects is called only during explicit save/print operations.
export async function embedEditorObjects(currentBytes, objects, layers = null, options = {}) {
  const pdfDoc = await PDFDocument.load(currentBytes);
  const pages = pdfDoc.getPages();
  const fontCache = new Map();

  const getFont = async (obj) => {
    const key = resolveFontKey(obj);
    if (!fontCache.has(key)) {
      fontCache.set(key, await pdfDoc.embedFont(key));
    }
    return fontCache.get(key);
  };

  for (const obj of objects) {
    if (obj.visible === false) continue;
    if (layers && layers[obj.layerId]?.visible === false) continue;
    if (obj.type === 'group') continue;

    const pageIndex = obj.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    if (obj.type === 'text') {
      const font = await getFont(obj);
      const color = hexToRgbColor(obj.color, rgb(0, 0, 0));
      const { rotate } = transformToPdfLib(obj.transform);
      drawTextBox(page, obj, font, { color, rotate });
    } else if (obj.type === 'signature') {
      const isJpg = String(obj.dataUrl || '').startsWith('data:image/jpeg');
      const imgBytes = await fetch(obj.dataUrl).then(r => r.arrayBuffer());
      const image = isJpg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
      const { rotate } = transformToPdfLib(obj.transform);
      page.drawImage(image, {
        x: obj.pdfX,
        y: obj.pdfY,
        width: obj.width,
        height: obj.height,
        rotate,
      });
    } else if (obj.type === 'image') {
      const isJpg = String(obj.dataUrl || '').startsWith('data:image/jpeg');
      const imgBytes = await fetch(obj.dataUrl).then(r => r.arrayBuffer());
      const image = isJpg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
      const { rotate } = transformToPdfLib(obj.transform);
      page.drawImage(image, {
        x: obj.pdfX,
        y: obj.pdfY,
        width: obj.width,
        height: obj.height,
        rotate,
      });
    } else if (obj.type === 'highlight') {
      page.drawRectangle({
        x: obj.pdfX,
        y: obj.pdfY,
        width: obj.width,
        height: obj.height,
        color: hexToRgbColor(obj.color, rgb(1, 0.92, 0.23)),
        opacity: obj.opacity ?? 0.35,
      });
    } else if (obj.type === 'redact') {
      page.drawRectangle({
        x: obj.pdfX,
        y: obj.pdfY,
        width: obj.width,
        height: obj.height,
        color: hexToRgbColor(obj.color, rgb(0, 0, 0)),
        opacity: obj.opacity ?? 1,
      });
    } else if (obj.type === 'whiteout') {
      page.drawRectangle({
        x: obj.pdfX,
        y: obj.pdfY,
        width: obj.width,
        height: obj.height,
        color: hexToRgbColor(obj.color, rgb(1, 1, 1)),
        opacity: obj.opacity ?? 1,
      });
    } else if (obj.type === 'drawing') {
      const points = obj.pdfPoints || obj.points || [];
      for (let i = 1; i < points.length; i++) {
        const x1 = points[i - 1].x;
        const y1 = points[i - 1].y;
        const x2 = points[i].x;
        const y2 = points[i].y;
        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness: obj.lineWidth || 2,
          color: hexToRgbColor(obj.color, rgb(0, 0, 0)),
        });
      }
    } else if (obj.type === 'formField') {
      try {
        const form = pdfDoc.getForm();
        const field = form.getField(obj.fieldName);
        if (field.constructor.name === 'PDFTextField') {
          field.setText(obj.fieldValue ?? '');
        } else if (field.constructor.name === 'PDFCheckBox') {
          obj.fieldValue === 'On' || obj.fieldValue === true ? field.check() : field.uncheck();
        } else if (field.constructor.name === 'PDFDropdown') {
          field.select(obj.fieldValue ?? '');
        }
      } catch (err) {
        console.warn(`Could not fill field ${obj.fieldName}:`, err);
      }
    }
  }

  if (options.flattenForm) {
    try {
      pdfDoc.getForm().flatten();
    } catch (err) {
      console.warn('Failed to flatten form:', err);
    }
  }

  return pdfDoc.save();
}

export async function embedAnnotations(currentBytes, annotations) {
  return embedEditorObjects(currentBytes, annotations);
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

/**
 * Like embedEditorObjects, but pages that contain 'redact' or 'whiteout' objects
 * are rasterized to a flat image so the underlying text/image content is
 * permanently removed from the PDF structure — not merely painted over.
 *
 * @param {Uint8Array} currentBytes  Original PDF bytes
 * @param {object[]}   objects       Editor objects
 * @param {object}     layers        Layer visibility map
 * @param {object}     renderDoc     PDF.js document (used to render pages)
 * @param {object}     [options]     Forwarded to embedEditorObjects
 */
/**
 * Re-embed a page's text as an INVISIBLE, searchable/selectable layer, excluding
 * any text that intersects a redaction rectangle.
 *
 * The page has already been flattened to a raster image (all original content
 * streams destroyed), so the sensitive content is gone. This restores search,
 * copy, and accessibility for everything that was NOT redacted — without ever
 * re-introducing redacted text. Coordinates are PDF points (bottom-left origin),
 * matching pdf.js text-item transforms and pdf-lib's drawing space.
 *
 * Safety bias: a text item that touches a redaction rect at all is dropped
 * entirely. Better to lose a word's searchability than to leak redacted content.
 */
async function embedSearchableTextLayer(page, pdfPage, redactRects, font) {
  let textContent;
  try {
    textContent = await pdfPage.getTextContent();
  } catch {
    return; // no extractable text (e.g. already-scanned page) — nothing to restore
  }

  for (const item of textContent.items) {
    const str = item.str;
    if (!str || !str.trim()) continue;

    const t = item.transform; // [a, b, c, d, e, f]
    const x = t[4];
    const yBaseline = t[5];
    const size = Math.hypot(t[2], t[3]) || item.height || 10;
    const w = item.width || str.length * size * 0.5;

    // Generous item bbox (a touch below baseline for descenders, up to ascent).
    const box = {
      x0: x,
      y0: yBaseline - size * 0.25,
      x1: x + w,
      y1: yBaseline + size,
    };
    const touchesRedaction = redactRects.some((r) =>
      !(box.x1 <= r.x0 || box.x0 >= r.x1 || box.y1 <= r.y0 || box.y0 >= r.y1)
    );
    if (touchesRedaction) continue;

    try {
      page.drawText(str, { x, y: yBaseline, size, font, opacity: 0 });
    } catch {
      // Standard font can't encode this glyph — skip it. Never re-add redacted text.
    }
  }
}

export async function secureEmbed(currentBytes, objects, layers, renderDoc, options = {}) {
  // Which page numbers have secure objects?
  const securePageNumbers = new Set(
    objects.filter(o => REDACT_TYPES.has(o.type)).map(o => o.page)
  );

  // Step 1 — embed ALL annotations normally (correct z-order, replacement text on top)
  const annotatedBytes = await embedEditorObjects(currentBytes, objects, layers, options);

  if (securePageNumbers.size === 0) return annotatedBytes;

  // Step 2 — load the annotated PDF and a render-doc so PDF.js shows the final visual
  const pdfDoc         = await PDFDocument.load(annotatedBytes);
  const annotRenderDoc = await getRenderDoc(annotatedBytes);
  const srcPages       = pdfDoc.getPages();

  // Build a new PDF: secure pages → rasterized image, others → copy as-is
  const outDoc = await PDFDocument.create();
  const searchFont = await outDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < srcPages.length; i++) {
    const pageNum   = i + 1;
    const srcPage   = srcPages[i];
    const { width, height } = srcPage.getSize();

    if (!securePageNumbers.has(pageNum)) {
      // Non-redacted page: copy verbatim (text searchable, annotations intact)
      const [copied] = await outDoc.copyPages(pdfDoc, [i]);
      outDoc.addPage(copied);
      continue;
    }

    // Redacted page: render to canvas at 2× for print quality
    const SCALE    = 2;
    const pdfPage  = await annotRenderDoc.getPage(pageNum);
    const viewport = pdfPage.getViewport({ scale: SCALE });

    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    // Convert canvas → PNG → embed in output doc
    const blob     = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const imgBytes = new Uint8Array(await blob.arrayBuffer());
    const pngImage = await outDoc.embedPng(imgBytes);

    // Fresh blank page — NO original content streams survive
    const newPage = outDoc.addPage([width, height]);
    newPage.drawImage(pngImage, { x: 0, y: 0, width, height });

    // Restore searchability for the non-redacted text via an invisible layer.
    const redactRects = objects
      .filter((o) => REDACT_TYPES.has(o.type) && o.page === pageNum)
      .map((o) => ({ x0: o.pdfX, y0: o.pdfY, x1: o.pdfX + o.width, y1: o.pdfY + o.height }));
    await embedSearchableTextLayer(newPage, pdfPage, redactRects, searchFont);
  }

  return new Uint8Array(await outDoc.save());
}

export async function saveWithDialog(bytes, filename) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([bytes], { type: 'application/pdf' }));
      await writable.close();
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      throw err;
    }
  }
  downloadBlob(bytes, filename);
  return true;
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
  const cos45 = Math.cos(Math.PI / 4);
  const sin45 = Math.sin(Math.PI / 4);
  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.min(width, height) / 6;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = fontSize * 0.75;
    const x = width / 2 - (textWidth * cos45) / 2 + (textHeight * sin45) / 2;
    const y = height / 2 - (textWidth * sin45) / 2 - (textHeight * cos45) / 2;
    page.drawText(text, {
      x,
      y,
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
  const w = window.open(url, '_blank');
  if (w) {
    setTimeout(() => {
      try { w.print(); } catch { /* user can print from PDF viewer */ }
    }, 1000);
  } else {
    alert('Please allow popups to print.');
    URL.revokeObjectURL(url);
  }
}
