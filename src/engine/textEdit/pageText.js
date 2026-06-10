// Extract a page's text runs straight from PDF bytes.
//
// Bridges pdf-lib (structure) and the tokenizer/extractor: pulls the page's
// content stream(s) and runs extractTextRuns. Decoding uses pdf-lib's own
// decodePDFRawStream, which handles FlateDecode (and other filters) in pure JS
// — works identically in the browser and Node, with no platform stream API.

import { PDFDocument, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { extractTextRuns } from './textRuns';

function decodeStreamBytes(stream) {
  try {
    return decodePDFRawStream(stream).decode();
  } catch {
    return stream?.contents || new Uint8Array();
  }
}

export async function getPageContent(pdfBytes, pageNumber) {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageNumber - 1];
  if (!page) return '';

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

export async function getPageRuns(pdfBytes, pageNumber) {
  return extractTextRuns(await getPageContent(pdfBytes, pageNumber));
}
