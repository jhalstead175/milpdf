// Extract a page's text runs straight from PDF bytes.
//
// Bridges pdf-lib (structure) and the tokenizer/extractor: pulls the page's
// content stream(s), inflates FlateDecode, and runs extractTextRuns. Inflation
// uses the platform DecompressionStream so this works in both the browser and
// Node (18+) — no extra dependency.

import { PDFDocument, PDFName } from 'pdf-lib';
import { extractTextRuns } from './textRuns';

async function inflateDeflate(bytes) {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function isFlate(stream) {
  try {
    const f = stream.dict?.lookup?.(PDFName.of('Filter'));
    if (!f) return false;
    const s = f.constructor?.name === 'PDFArray'
      ? f.asArray().map((x) => String(x)).join(',')
      : String(f);
    return s.includes('FlateDecode');
  } catch {
    return false;
  }
}

async function decodeStream(stream) {
  const raw = stream.contents;
  if (!raw) return new Uint8Array();
  return isFlate(stream) ? inflateDeflate(raw) : raw;
}

export async function getPageContent(pdfBytes, pageNumber) {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageNumber - 1];
  if (!page) return '';
  const resolved = doc.context.lookup(page.node.Contents());
  if (!resolved) return '';

  const streams = resolved.constructor?.name === 'PDFArray'
    ? resolved.asArray().map((ref) => doc.context.lookup(ref))
    : [resolved];

  const parts = [];
  for (const s of streams) {
    if (!s?.contents) continue;
    parts.push(new TextDecoder('latin1').decode(await decodeStream(s)));
  }
  return parts.join('\n');
}

export async function getPageRuns(pdfBytes, pageNumber) {
  return extractTextRuns(await getPageContent(pdfBytes, pageNumber));
}
