// Apply an in-place text edit: replace a located run's text and write the
// page's content stream back. Phase 3 of in-place editing.
//
// SCOPE / LIMITATION: the new text is encoded as a hex string of byte codes,
// which is correct for simple fonts with ASCII/WinAnsi-style encoding (the
// common case, and what pdf-lib emits). Subset/Type0/CID fonts map byte codes
// to glyph ids, so naive encoding would be wrong there — that's the Phase 4
// font strategy. Characters outside a single byte fall back to '?' for now.

import { PDFDocument, PDFName } from 'pdf-lib';
import { getPageContent } from './pageText';

const toLatin1Bytes = (str) => {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
};

// Encode text as a PDF hex-string operand: <48656C...>.
export function encodeHexString(text) {
  let hex = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    hex += (code > 0xff ? 0x3f : code).toString(16).padStart(2, '0'); // 0x3f = '?'
  }
  return `<${hex.toUpperCase()}>`;
}

// Splice a new string operand into the content at the run's byte range.
// Works for Tj (single string) and TJ (range spans the array's string parts;
// the surrounding [ ] / TJ stay intact, yielding [ <new> ] TJ).
export function replaceRunText(content, run, newText) {
  return content.slice(0, run.strByteStart) + encodeHexString(newText) + content.slice(run.strByteEnd);
}

export async function applyTextEdit(pdfBytes, pageNumber, run, newText) {
  if (run.editable === false) {
    throw new Error('This text uses an embedded font that cannot be edited in place yet.');
  }
  const content = await getPageContent(pdfBytes, pageNumber);
  const newContent = replaceRunText(content, run, newText);

  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageNumber - 1];
  if (!page) throw new Error(`Page ${pageNumber} not found`);

  // Replace the page's content with one fresh stream holding the edited bytes.
  const stream = doc.context.stream(toLatin1Bytes(newContent));
  const ref = doc.context.register(stream);
  page.node.set(PDFName.of('Contents'), ref);

  return doc.save();
}
