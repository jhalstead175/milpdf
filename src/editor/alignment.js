export function alignLeft(objects, ids) {
  const sel = objects.filter(o => ids.has(o.id));
  if (sel.length === 0) return [];
  const anchor = Math.min(...sel.map(o => o.pdfX));
  return sel.map(o => ({ id: o.id, pdfX: anchor }));
}

export function alignRight(objects, ids) {
  const sel = objects.filter(o => ids.has(o.id));
  if (sel.length === 0) return [];
  const anchor = Math.max(...sel.map(o => o.pdfX + o.width));
  return sel.map(o => ({ id: o.id, pdfX: anchor - o.width }));
}

export function alignTop(objects, ids) {
  const sel = objects.filter(o => ids.has(o.id));
  if (sel.length === 0) return [];
  const anchor = Math.max(...sel.map(o => o.pdfY + o.height));
  return sel.map(o => ({ id: o.id, pdfY: anchor - o.height }));
}
export function alignBottom(objects, ids) {
  const sel = objects.filter(o => ids.has(o.id));
  if (sel.length === 0) return [];
  const anchor = Math.min(...sel.map(o => o.pdfY));
  return sel.map(o => ({ id: o.id, pdfY: anchor }));
}

export function alignCenterH(objects, ids) {
  const sel = objects.filter(o => ids.has(o.id));
  if (sel.length === 0) return [];
  const center = sel.reduce((s, o) => s + (o.pdfX + o.width / 2), 0) / sel.length;
  return sel.map(o => ({ id: o.id, pdfX: center - o.width / 2 }));
}

export function alignCenterV(objects, ids) {
  const sel = objects.filter(o => ids.has(o.id));
  if (sel.length === 0) return [];
  const center = sel.reduce((s, o) => s + (o.pdfY + o.height / 2), 0) / sel.length;
  return sel.map(o => ({ id: o.id, pdfY: center - o.height / 2 }));
}
export function distributeHorizontally(objects, ids) {
  const sel = objects.filter(o => ids.has(o.id)).sort((a, b) => a.pdfX - b.pdfX);
  if (sel.length < 3) return [];
  const totalWidth = sel.reduce((s, o) => s + o.width, 0);
  const span = (sel[sel.length - 1].pdfX + sel[sel.length - 1].width) - sel[0].pdfX;
  const gap = (span - totalWidth) / (sel.length - 1);
  let cursor = sel[0].pdfX + sel[0].width + gap;
  return sel.slice(1, -1).map(o => {
    const patch = { id: o.id, pdfX: cursor };
    cursor += o.width + gap;
    return patch;
  });
}

export function distributeVertically(objects, ids) {
  const sel = objects.filter(o => ids.has(o.id)).sort((a, b) => a.pdfY - b.pdfY);
  if (sel.length < 3) return [];
  const totalHeight = sel.reduce((s, o) => s + o.height, 0);
  const span = (sel[sel.length - 1].pdfY + sel[sel.length - 1].height) - sel[0].pdfY;
  const gap = (span - totalHeight) / (sel.length - 1);
  let cursor = sel[0].pdfY + sel[0].height + gap;
  return sel.slice(1, -1).map(o => {
    const patch = { id: o.id, pdfY: cursor };
    cursor += o.height + gap;
    return patch;
  });
}
