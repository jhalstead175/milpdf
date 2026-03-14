import { buildDocumentIndex } from '../intelligence';

const docIndexCache = new WeakMap();

export async function buildCaseContext({
  renderDoc,
  evidenceIndex,
  caseGraph,
  options = {},
}) {
  let documentIndex = null;
  if (renderDoc) {
    if (docIndexCache.has(renderDoc)) {
      documentIndex = docIndexCache.get(renderDoc);
    } else {
      documentIndex = await buildDocumentIndex(renderDoc, options);
      docIndexCache.set(renderDoc, documentIndex);
    }
  }

  return {
    documentIndex,
    evidenceIndex,
    caseGraph,
    options,
  };
}
