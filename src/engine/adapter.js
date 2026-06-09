// Bridge between the legacy flat objects[] store and the engine model.
//
// During the migration the store is still the source of truth. This adapter
// projects one legacy page into an engine Page (ownership-based: objects live
// INSIDE the page, no page/pageId duality) so the engine — buildRenderList in
// particular — can run and be verified against real data BEFORE it takes over
// as the source of truth. Read-only; never mutates the store.
//
// Grouping mirrors the store's own `pages` selector (sceneGraph/store.js):
// prefer stable pageId, fall back to legacy page number.

// The single definition of "does this object belong to this page".
// Prefer the stable pageId; fall back to the legacy page number for objects
// created before they were assigned one. Both render and export derive page
// ownership from THIS function — there is no second copy to drift.
export function isObjectOnPage(meta, obj) {
  return obj.pageId ? obj.pageId === meta.id : obj.page === meta.number;
}

export function toEnginePage(meta, objects = []) {
  if (!meta) return null;
  const owned = objects.filter((o) => isObjectOnPage(meta, o));
  return {
    id: meta.id,
    width: meta.width,
    height: meta.height,
    rotation: meta.rotation || 0,
    objects: owned,
  };
}

// Build the full engine Document from the live store (pageMeta + flat objects).
// Page order follows pageMeta, which mirrors the real PDF page order.
export function toEngineDocument(pageMeta = [], objects = []) {
  return {
    pages: pageMeta.map((meta, index) => ({
      ...toEnginePage(meta, objects),
      number: index + 1,
    })),
  };
}

// Flatten an engine Document back to the flat objects[] the embed pipeline
// consumes — but with each object's `page` set from its OWNING page's index,
// not from a stale `obj.page`. This is what makes export ownership-authoritative:
// page reorder/insert/delete can no longer desync export from what the user sees.
export function documentToEmbedObjects(doc) {
  const out = [];
  for (const page of doc.pages) {
    for (const obj of page.objects) {
      out.push({ ...obj, page: page.number });
    }
  }
  return out;
}
