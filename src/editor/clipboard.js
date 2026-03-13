import { makeId } from '../utils/id';

let clipboard = null;

export function copyObjects(objects, ids) {
  const idSet = ids instanceof Set ? ids : new Set(ids || []);
  clipboard = objects
    .filter(o => idSet.has(o.id))
    .map(o => JSON.parse(JSON.stringify(o)));
}

export function pasteObjects(page, offsetPdf = 10) {
  if (!clipboard || clipboard.length === 0) return [];
  return clipboard.map(o => ({
    ...o,
    id: makeId(),
    page,
    pdfX: o.pdfX + offsetPdf,
    pdfY: o.pdfY - offsetPdf,
  }));
}

export function duplicateObjects(objects, ids) {
  copyObjects(objects, ids);
  const target = objects.find(o => (ids instanceof Set ? ids.has(o.id) : ids.includes(o.id)));
  return pasteObjects(target?.page ?? 1);
}
