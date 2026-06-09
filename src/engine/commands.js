// Engine commands — the ONLY way the document mutates.
//
// Every mutation goes through here. UI dispatches an intent; the engine applies
// it to the model. Tools never touch coordinates, bytes, or the DOM directly.
//
// These operate on a page (the object's owner). History/undo wraps these at a
// higher layer — these stay pure mutations so they are trivially testable.

export function addObject(page, object) {
  page.objects.push(object);
  return object;
}

export function updateObject(page, id, updates) {
  const obj = page.objects.find((o) => o.id === id);
  if (!obj) return null;
  Object.assign(obj, updates);
  return obj;
}

export function deleteObject(page, id) {
  page.objects = page.objects.filter((o) => o.id !== id);
}

// Find which page owns an object — convenience for callers holding only the doc.
export function findOwningPage(doc, objectId) {
  return doc.pages.find((p) => p.objects.some((o) => o.id === objectId)) || null;
}
