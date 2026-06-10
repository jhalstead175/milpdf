// PDF content-stream tokenizer.
//
// Foundation for in-place vector text editing: turns a decompressed content
// stream into a flat token list. Operates on a latin1 string (1 char = 1 byte),
// so every token's { start, end } are byte offsets into the stream — that's what
// lets later passes splice a replacement in by byte range.
//
// Handles: names (/Name with #xx escapes), literal strings ((..) with escapes),
// hex strings (<..>), numbers, operators, arrays, dicts, comments.
// Known limitation: inline images (BI/ID..EI) are not special-cased; their
// binary payload can mis-tokenize. Text-bearing pages rarely use them; a later
// pass can skip BI..EI explicitly.

const WHITESPACE = new Set(['\x00', '\t', '\n', '\f', '\r', ' ']);
const DELIM = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);

const isWs = (c) => WHITESPACE.has(c);
const isReg = (c) => !isWs(c) && !DELIM.has(c);

export function tokenize(str) {
  const tokens = [];
  const n = str.length;
  let i = 0;

  while (i < n) {
    const c = str[i];
    if (isWs(c)) { i++; continue; }
    const start = i;

    if (c === '%') { // comment to end of line
      while (i < n && str[i] !== '\n' && str[i] !== '\r') i++;
      continue;
    }

    if (c === '/') { // name
      i++;
      let name = '';
      while (i < n && isReg(str[i])) {
        if (str[i] === '#' && i + 2 < n) {
          name += String.fromCharCode(parseInt(str.substr(i + 1, 2), 16));
          i += 3;
        } else { name += str[i]; i++; }
      }
      tokens.push({ type: 'name', value: name, start, end: i });
      continue;
    }

    if (c === '(') { // literal string
      i++;
      let depth = 1;
      let out = '';
      const esc = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      while (i < n && depth > 0) {
        const ch = str[i];
        if (ch === '\\') {
          const nx = str[i + 1];
          if (nx in esc) { out += esc[nx]; i += 2; }
          else if (nx >= '0' && nx <= '7') {
            let oct = nx; i += 2;
            for (let k = 0; k < 2 && str[i] >= '0' && str[i] <= '7'; k++) { oct += str[i]; i++; }
            out += String.fromCharCode(parseInt(oct, 8) & 0xff);
          } else if (nx === '\n') { i += 2; }
          else if (nx === '\r') { i += (str[i + 2] === '\n') ? 3 : 2; }
          else { out += nx; i += 2; }
        } else if (ch === '(') { depth++; out += ch; i++; }
        else if (ch === ')') { depth--; if (depth > 0) out += ch; i++; }
        else { out += ch; i++; }
      }
      tokens.push({ type: 'string', kind: 'literal', value: out, start, end: i });
      continue;
    }

    if (c === '<') {
      if (str[i + 1] === '<') { tokens.push({ type: 'dictStart', start, end: i + 2 }); i += 2; continue; }
      i++; // hex string
      let hex = '';
      while (i < n && str[i] !== '>') { if (!isWs(str[i])) hex += str[i]; i++; }
      i++; // consume '>'
      if (hex.length % 2) hex += '0';
      let out = '';
      for (let k = 0; k < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.substr(k, 2), 16));
      tokens.push({ type: 'string', kind: 'hex', value: out, start, end: i });
      continue;
    }

    if (c === '>') { if (str[i + 1] === '>') { tokens.push({ type: 'dictEnd', start, end: i + 2 }); i += 2; continue; } i++; continue; }
    if (c === '[') { tokens.push({ type: 'arrayStart', start, end: i + 1 }); i++; continue; }
    if (c === ']') { tokens.push({ type: 'arrayEnd', start, end: i + 1 }); i++; continue; }
    if (c === '{' || c === '}') { i++; continue; }

    // number or operator (regular-char run)
    let word = '';
    while (i < n && isReg(str[i])) { word += str[i]; i++; }
    if (word === '') { i++; continue; }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      tokens.push({ type: 'number', value: parseFloat(word), start, end: i });
    } else {
      tokens.push({ type: 'op', value: word, start, end: i });
    }
  }

  return tokens;
}
