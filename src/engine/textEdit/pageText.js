// Extract a page's text runs straight from PDF bytes.
//
// Bridges pdf-lib (structure) and the tokenizer/extractor: pulls the page's
// content stream(s) and runs extractTextRuns, then annotates each run with
// whether its font is safely editable in place (see fontInfo). Decoding uses
// pdf-lib's own decodePDFRawStream (pure JS, browser + Node).

import { PDFDocument, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { extractTextRuns } from './textRuns';
import { getPageFontMap } from './fontInfo';
import { decodeWithCMap } from './cmap';

function decodeStreamBytes(stream) {
  try {
    return decodePDFRawStream(stream).decode();
  } catch {
    return stream?.contents || new Uint8Array();
  }
}

function decodePageContent(doc, page) {
  const resolved = doc.context.lookup(page.node.Contents());
  if (!resolved) return '';
  // Contents may be a single stream or an array of streams (concatenated).
  // Use instanceof, not constructor.name — bundlers mangle class names.
  const streams = resolved instanceof PDFArray
    ? resolved.asArray().map((ref) => doc.context.lookup(ref))
    : [resolved];
  const parts = [];
  for (const s of streams) {
    if (!s) continue;
    parts.push(new TextDecoder('latin1').decode(decodeStreamBytes(s)));
  }
  return parts.join('\n');
}

export async function getPageContent(pdfBytes, pageNumber) {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageNumber - 1];
  return page ? decodePageContent(doc, page) : '';
}

export async function getPageRuns(pdfBytes, pageNumber) {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageNumber - 1];
  if (!page) return [];
  const content = decodePageContent(doc, page);
  const fontMap = getPageFontMap(doc, page);
  return extractTextRuns(content).map((run) => {
    const info = fontMap.get(run.fontRef);
    // Prefer ToUnicode-decoded text for display (correct for CID/Type0 fonts,
    // whose raw run.text is glyph codes). Fall back to the raw operand text.
    let displayText = run.text;
    if (info?.toUnicode) {
      const decoded = decodeWithCMap(run.text, info.toUnicode.codeLen, info.toUnicode.map);
      if (decoded) displayText = decoded;
    }
    return {
      ...run,
      displayText,
      editable: info ? info.editable : false,
      fontSubtype: info?.subtype ?? null,
    };
  });
}
