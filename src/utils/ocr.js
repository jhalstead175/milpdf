import { createWorker } from 'tesseract.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { renderPageToCanvas } from './pdfUtils';

// All engine + language assets are bundled under /ocr so OCR runs fully
// offline and the document never leaves the device.
const OCR_PATHS = {
  workerPath: '/ocr/worker.min.js',
  corePath: '/ocr/tesseract-core-simd-lstm.wasm.js',
  langPath: '/ocr',
};

// Pages with little/no extractable text are treated as scans needing OCR.
export async function detectScannedPages(renderDoc, numPages, threshold = 16) {
  const scanned = [];
  for (let p = 1; p <= numPages; p++) {
    let len = 0;
    try {
      const page = await renderDoc.getPage(p);
      const tc = await page.getTextContent();
      len = tc.items.reduce((sum, it) => sum + (it.str ? it.str.trim().length : 0), 0);
    } catch {
      len = 0;
    }
    if (len < threshold) scanned.push(p);
  }
  return scanned;
}

export function createOcrWorker(onLog) {
  return createWorker('eng', 1, {
    workerPath: OCR_PATHS.workerPath,
    corePath: OCR_PATHS.corePath,
    langPath: OCR_PATHS.langPath,
    logger: onLog,
  });
}

// Flatten tesseract's nested result into a flat word list (v7 returns words
// inside blocks→paragraphs→lines; older shapes expose data.words directly).
function collectWords(data) {
  const out = [];
  const push = (w) => {
    if (w && w.text && w.text.trim() && w.bbox) out.push({ text: w.text, bbox: w.bbox });
  };
  if (Array.isArray(data.words) && data.words.length) {
    data.words.forEach(push);
    return out;
  }
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const word of line.words || []) push(word);
      }
    }
  }
  return out;
}

// OCR one page; returns words with pixel bboxes plus the render scale used.
export async function ocrPage(worker, renderDoc, pageNum, scale = 2) {
  const canvas = document.createElement('canvas');
  await renderPageToCanvas(renderDoc, pageNum, canvas, scale);
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  return { words: collectWords(data), scale };
}

// Draw the recognized words as invisible (opacity 0) text at the matching PDF
// coordinates, so the scan becomes selectable/searchable, image untouched.
export async function embedOcrLayer(pdfBytes, pageResults) {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  let wordsAdded = 0;

  for (const { pageNum, words, scale } of pageResults) {
    const page = pages[pageNum - 1];
    if (!page) continue;
    const { height } = page.getSize();
    for (const w of words) {
      const text = w.text.trim();
      if (!text) continue;
      const fontSize = Math.max(2, (w.bbox.y1 - w.bbox.y0) / scale);
      const x = w.bbox.x0 / scale;
      const y = height - w.bbox.y1 / scale; // tesseract y is top-down; PDF is bottom-up
      try {
        page.drawText(text, { x, y, size: fontSize, font, opacity: 0 });
        wordsAdded += 1;
      } catch {
        // standard font can't encode this glyph — skip it
      }
    }
  }

  const bytes = await doc.save();
  return { bytes, wordsAdded };
}

// Orchestrate: detect (or take) target pages, OCR each, embed the layer.
export async function runOcr({ pdfBytes, renderDoc, pages, onProgress }) {
  const worker = await createOcrWorker((m) => {
    if (m.status === 'recognizing text' && typeof m.progress === 'number') {
      onProgress?.({ phase: 'recognize', progress: m.progress });
    }
  });

  const results = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      const pageNum = pages[i];
      onProgress?.({ phase: 'page', pageNum, index: i, total: pages.length });
      const { words, scale } = await ocrPage(worker, renderDoc, pageNum);
      results.push({ pageNum, words, scale });
    }
  } finally {
    await worker.terminate();
  }

  onProgress?.({ phase: 'embed' });
  const { bytes, wordsAdded } = await embedOcrLayer(pdfBytes, results);
  return { bytes, wordsAdded, pagesProcessed: pages.length };
}
