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

export function toEnginePage(meta, objects = []) {
  if (!meta) return null;
  const owned = objects.filter((o) =>
    o.pageId ? o.pageId === meta.id : o.page === meta.number
  );
  return {
    id: meta.id,
    width: meta.width,
    height: meta.height,
    rotation: meta.rotation || 0,
    objects: owned,
  };
}
