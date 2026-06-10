// Minimal /ToUnicode CMap parser + decoder.
//
// For composite (Type0/CID) fonts a run's bytes are glyph/CID codes, not text —
// so run.text from the tokenizer is garbage. The font's /ToUnicode CMap maps
// those codes to Unicode, which is what lets us show the REAL text (for now,
// read-only; later, to pre-fill an edit). Handles bfchar + bfrange and infers
// code byte length from the codespacerange.

function hexUnits(hex) {
  const units = [];
  for (let i = 0; i + 4 <= hex.length; i += 4) units.push(parseInt(hex.substr(i, 4), 16));
  return units;
}
const hexToStr = (hex) => String.fromCharCode(...hexUnits(hex));
function hexToStrPlus(hex, add) {
  const units = hexUnits(hex);
  if (units.length) units[units.length - 1] += add;
  return String.fromCharCode(...units);
}

export function parseToUnicodeCMap(cmap) {
  let codeLen = 1;
  const map = new Map();

  const csr = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(cmap);
  if (csr) {
    const m = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(csr[1]);
    if (m) codeLen = Math.max(1, Math.round(m[1].length / 2));
  }

  let block;
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((block = bfcharRe.exec(cmap))) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p;
    while ((p = pairRe.exec(block[1]))) map.set(parseInt(p[1], 16), hexToStr(p[2]));
  }

  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((block = bfrangeRe.exec(cmap))) {
    const lineRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g;
    let l;
    while ((l = lineRe.exec(block[1]))) {
      const lo = parseInt(l[1], 16);
      const hi = parseInt(l[2], 16);
      if (l[3] != null) {
        for (let code = lo, i = 0; code <= hi; code++, i++) map.set(code, hexToStrPlus(l[3], i));
      } else if (l[4] != null) {
        const arr = [...l[4].matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => x[1]);
        for (let code = lo, i = 0; code <= hi && i < arr.length; code++, i++) map.set(code, hexToStr(arr[i]));
      }
    }
  }

  return { codeLen, map };
}

// Decode a raw operand string (1 char == 1 byte) into Unicode via the CMap.
export function decodeWithCMap(rawText, codeLen, map) {
  let out = '';
  for (let i = 0; i + codeLen <= rawText.length; i += codeLen) {
    let code = 0;
    for (let j = 0; j < codeLen; j++) code = (code << 8) | (rawText.charCodeAt(i + j) & 0xff);
    out += map.get(code) ?? '';
  }
  return out;
}
