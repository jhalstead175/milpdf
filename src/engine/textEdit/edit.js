// Apply an in-place text edit and write the page's content stream back.
//
// Three strategies:
//  - Plain edit (editable run, no format changes): replace the string operand
//    in place, keeping the original font (perfect fidelity).
//  - Formatted edit (editable run + fmt options): wrap the show op with new
//    color/font/size operators and restore originals after the run.
//  - Non-editable run (Type0/CID, subset, etc.): substitute a standard font
//    for just that run, applying any fmt options, and restore after.

import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { getPageContent } from './pageText';

const SUBST_FONT_NAME = 'MilPDFEdit';

const STANDARD_FONT_MAP = {
  'Arial':           StandardFonts.Helvetica,
  'Calibri':         StandardFonts.Helvetica,
  'Helvetica':       StandardFonts.Helvetica,
  'Verdana':         StandardFonts.Helvetica,
  'Courier New':     StandardFonts.Courier,
  'Courier':         StandardFonts.Courier,
  'Georgia':         StandardFonts.TimesRoman,
  'Times New Roman': StandardFonts.TimesRoman,
  'Times':           StandardFonts.TimesRoman,
};

const toLatin1Bytes = (str) => {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
};

function hexToRgb(hex) {
  const h = (hex || '#000000').replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

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

async function registerFont(doc, page, stdFont, name) {
  const font = await doc.embedFont(stdFont);
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
  fontRes.set(PDFName.of(name), font.ref);
  return name;
}

async function registerSubstituteFont(doc, page) {
  return registerFont(doc, page, StandardFonts.Helvetica, SUBST_FONT_NAME);
}

async function registerNamedFont(doc, page, fontFamily) {
  const stdFont = STANDARD_FONT_MAP[fontFamily] || StandardFonts.Helvetica;
  const name = 'MilEd_' + fontFamily.replace(/\s+/g, '_');
  return registerFont(doc, page, stdFont, name);
}

// Build the operator sequence for a formatted run.
// Preserves the run's implicit line-advance (T* for ' and " operators) and
// restores the inherited fill color rather than hardcoding black.
function buildFormattedSeq(fontRef, size, newText, origFontRef, origSize, color, run) {
  let seq = '';

  // ' and " operators imply T* (line advance) before the show.
  if (run?.op === "'" || run?.op === '"') seq += 'T* ';

  if (color) {
    const { r, g, b } = hexToRgb(color);
    seq += `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)} rg `;
  }
  seq += `/${fontRef} ${size} Tf ${encodeHexString(newText)} Tj /${origFontRef} ${origSize} Tf`;
  if (color) {
    // Restore the color that was in effect before the run, not necessarily black.
    const [pr, pg, pb] = run?.fillColor ?? [0, 0, 0];
    seq += ` ${pr.toFixed(4)} ${pg.toFixed(4)} ${pb.toFixed(4)} rg`;
  }
  return seq;
}

export async function applyTextEdit(pdfBytes, pageNumber, run, newText, fmt = {}) {
  const content = await getPageContent(pdfBytes, pageNumber);
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageNumber - 1];
  if (!page) throw new Error(`Page ${pageNumber} not found`);

  const origSize = run.fontSize || 12;
  const origFontRef = run.fontRef;
  const hasFormatting = fmt.fontFamily || fmt.fontSize || fmt.color;

  let newContent;

  if (run.editable === false || hasFormatting) {
    if (run.opByteStart == null || run.opByteEnd == null) {
      throw new Error('This text run cannot be edited in place.');
    }

    let fontRef;
    if (fmt.fontFamily) {
      fontRef = await registerNamedFont(doc, page, fmt.fontFamily);
    } else if (run.editable === false) {
      fontRef = await registerSubstituteFont(doc, page);
    } else {
      fontRef = origFontRef;
    }

    const size = fmt.fontSize || origSize;
    const seq = buildFormattedSeq(fontRef, size, newText, origFontRef, origSize, fmt.color || null, run);
    newContent = content.slice(0, run.opByteStart) + seq + content.slice(run.opByteEnd);
  } else {
    newContent = replaceRunText(content, run, newText);
  }

  // pdf-lib PDFContext.stream(entries, contents) — entries dict first, bytes second.
  const stream = doc.context.stream({}, toLatin1Bytes(newContent));
  page.node.set(PDFName.of('Contents'), doc.context.register(stream));
  return doc.save();
}
