// Text-run extraction from a PDF content stream.
//
// Walks the tokens, tracks the CTM (q/Q/cm) and text matrices (BT/Tm/Td/TD/T*),
// and emits one record per show-text operator (Tj/TJ/'/") with:
//   - text      : decoded Unicode-ish string (latin1/WinAnsi; CID fonts decode
//                 via their byte codes, so Type0 text may need a CMap later)
//   - x, y      : baseline origin in page space (text matrix x CTM)
//   - fontRef   : the /Font resource name in effect (e.g. "Helvetica-1234")
//   - fontSize  : current Tf size
//   - strByteStart/End : byte range of the string operand(s) in the stream —
//                 the splice target for an edit
//
// This is the locate layer of in-place editing. It does not yet mutate anything.

import { tokenize } from './tokenizer';

const ident = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

function mul(m1, m2) {
  return {
    a: m1.a * m2.a + m1.b * m2.c,
    b: m1.a * m2.b + m1.b * m2.d,
    c: m1.c * m2.a + m1.d * m2.c,
    d: m1.c * m2.b + m1.d * m2.d,
    e: m1.e * m2.a + m1.f * m2.c + m2.e,
    f: m1.e * m2.b + m1.f * m2.d + m2.f,
  };
}

const translate = (tx, ty) => ({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });

export function extractTextRuns(content) {
  const tokens = tokenize(content);
  const runs = [];

  let ctm = ident();
  const ctmStack = [];
  let tm = ident();
  let lm = ident();
  let fontRef = null;
  let fontSize = 0;
  let leading = 0;
  let operands = [];

  const num = (k) => (operands[k]?.type === 'number' ? operands[k].value : 0);
  const lastString = () => {
    for (let k = operands.length - 1; k >= 0; k--) if (operands[k].type === 'string') return operands[k];
    return null;
  };

  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (tok.type !== 'op') { operands.push(tok); continue; }

    switch (tok.value) {
      case 'q': ctmStack.push({ ...ctm }); break;
      case 'Q': ctm = ctmStack.pop() || ident(); break;
      case 'cm': ctm = mul({ a: num(0), b: num(1), c: num(2), d: num(3), e: num(4), f: num(5) }, ctm); break;
      case 'BT': tm = ident(); lm = ident(); break;
      case 'Tf': fontRef = operands[0]?.value ?? fontRef; fontSize = num(1); break;
      case 'TL': leading = num(0); break;
      case 'Td': lm = mul(translate(num(0), num(1)), lm); tm = { ...lm }; break;
      case 'TD': leading = -num(1); lm = mul(translate(num(0), num(1)), lm); tm = { ...lm }; break;
      case 'Tm': tm = { a: num(0), b: num(1), c: num(2), d: num(3), e: num(4), f: num(5) }; lm = { ...tm }; break;
      case 'T*': lm = mul(translate(0, -leading), lm); tm = { ...lm }; break;

      case "'":
      case '"': {
        lm = mul(translate(0, -leading), lm); tm = { ...lm };
        const s = lastString();
        if (s) {
          const trm = mul(tm, ctm);
          runs.push({ text: s.value, x: trm.e, y: trm.f, fontRef, fontSize, strByteStart: s.start, strByteEnd: s.end, strKind: s.kind, opIndex: t });
        }
        break;
      }
      case 'Tj': {
        const s = lastString();
        if (s) {
          const trm = mul(tm, ctm);
          runs.push({ text: s.value, x: trm.e, y: trm.f, fontRef, fontSize, strByteStart: s.start, strByteEnd: s.end, strKind: s.kind, opIndex: t });
        }
        break;
      }
      case 'TJ': {
        let text = '';
        let first = null;
        let last = null;
        for (const o of operands) {
          if (o.type === 'string') { text += o.value; if (!first) first = o; last = o; }
        }
        if (first) {
          const trm = mul(tm, ctm);
          runs.push({ text, x: trm.e, y: trm.f, fontRef, fontSize, strByteStart: first.start, strByteEnd: last.end, strKind: 'array', opIndex: t });
        }
        break;
      }
      default: break;
    }
    operands = [];
  }

  return runs;
}
