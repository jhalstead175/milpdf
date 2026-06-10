// Apply an in-place text edit and write the page's content stream back.
//
// Two strategies:
//  - Editable run (simple ASCII/WinAnsi font): replace the string operand in
//    place, keeping the original font (perfect fidelity). Phase 3.
//  - Non-editable run (Type0/CID, subset, etc.): SUBSTITUTE a standard font for
//    just that run — wrap the show op with `/Subst size Tf ... Tj /Orig size Tf`
//    so following text keeps the original font. The edited run renders in
//    Helvetica (typeface changes), but it renders correctly and is searchable.
//    Phase 4b/2.

import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { getPageContent } from './pageText';

const SUBST_FONT_NAME = 'MilPDFEdit';

const toLatin1Bytes = (str) => {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
};

// Encode text as a PDF hex-string operand: <48656C...> (WinAnsi byte codes).
export function encodeHexString(text) {
  let hex = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    hex += (code > 0xff ? 0x3f : code).toString(16).padStart(2, '0'); // 0x3f = '?'
  }
  return `<${hex.toUpperCase()}>`;
}

// Splice a new string operand into the content at the run's byte range.
export function replaceRunText(content, run, newText) {
  return content.slice(0, run.strByteStart) + encodeHexString(newText) + content.slice(run.strByteEnd);
}

async function registerSubstituteFont(doc, page) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let resources = doc.context.lookup(page.node.get(PDFName.of('Resources')));
  if (!resources && typeof page.node.Resources === 'function') {
    resources = doc.context.lookup(page.node.Resources());
  }
  if (!resources) {
    resources = doc.context.obj({});
    page.node.set(PDFName.of('Resources'), doc.context.register(resources));
  }
  let fontRes = doc.context.lookup(resources.get(PDFName.of('Font')));
  if (!fontRes) {
    fontRes = doc.context.obj({});
    resources.set(PDFName.of('Font'), doc.context.register(fontRes));
  }
  fontRes.set(PDFName.of(SUBST_FONT_NAME), font.ref);
  return SUBST_FONT_NAME;
}

export async function applyTextEdit(pdfBytes, pageNumber, run, newText) {
  const content = await getPageContent(pdfBytes, pageNumber);
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageNumber - 1];
  if (!page) throw new Error(`Page ${pageNumber} not found`);

  let newContent;
  if (run.editable === false) {
    // Substitute a standard font for this run, restoring the original after.
    if (run.opByteStart == null || run.opByteEnd == null) {
      throw new Error('This text run cannot be edited in place.');
    }
    const subst = await registerSubstituteFont(doc, page);
    const size = run.fontSize || 12;
    const seq = `/${subst} ${size} Tf ${encodeHexString(newText)} Tj /${run.fontRef} ${size} Tf`;
    newContent = content.slice(0, run.opByteStart) + seq + content.slice(run.opByteEnd);
  } else {
    newContent = replaceRunText(content, run, newText);
  }

  const stream = doc.context.stream(toLatin1Bytes(newContent));
  page.node.set(PDFName.of('Contents'), doc.context.register(stream));
  return doc.save();
}
