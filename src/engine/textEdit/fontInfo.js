// Font analysis for safe in-place editing.
//
// Our edit encodes new text as single-byte codes (correct for simple fonts with
// a byte-encoding). Composite/Type0 (CID) fonts map bytes to glyph ids via a
// CMap — single-byte re-encoding would corrupt them. So we only allow editing
// runs whose font is a simple single-byte type; everything else is declined
// (Phase 4b will substitute a standard font to edit those too).

import { PDFName, decodePDFRawStream } from 'pdf-lib';
import { parseToUnicodeCMap } from './cmap';

const EDITABLE_SUBTYPES = new Set(['Type1', 'TrueType', 'MMType1']);

function readToUnicode(doc, fontDict) {
  try {
    const stream = doc.context.lookup(fontDict.get(PDFName.of('ToUnicode')));
    if (!stream || typeof stream.contents === 'undefined') return null;
    const bytes = decodePDFRawStream(stream).decode();
    return parseToUnicodeCMap(new TextDecoder('latin1').decode(bytes));
  } catch {
    return null;
  }
}

function nameToString(obj) {
  if (obj == null) return null;
  const s = typeof obj.asString === 'function' ? obj.asString() : String(obj);
  return s.replace(/^\//, '');
}

function resolveResources(doc, page) {
  try {
    if (typeof page.node.Resources === 'function') {
      const r = page.node.Resources();
      if (r) return doc.context.lookup(r);
    }
  } catch { /* fall through */ }
  try {
    return doc.context.lookup(page.node.get(PDFName.of('Resources')));
  } catch {
    return null;
  }
}

// Map<fontResourceName, { subtype, editable }> for one page.
export function getPageFontMap(doc, page) {
  const map = new Map();
  try {
    const resources = resolveResources(doc, page);
    if (!resources?.get) return map;
    const fontDict = doc.context.lookup(resources.get(PDFName.of('Font')));
    if (!fontDict || typeof fontDict.entries !== 'function') return map;
    for (const [key, ref] of fontDict.entries()) {
      const fdict = doc.context.lookup(ref);
      const subtype = nameToString(fdict?.get?.(PDFName.of('Subtype')));
      map.set(nameToString(key), {
        subtype,
        editable: EDITABLE_SUBTYPES.has(subtype),
        toUnicode: readToUnicode(doc, fdict),
      });
    }
  } catch {
    /* leave empty — callers treat unknown fonts as not-editable */
  }
  return map;
}
