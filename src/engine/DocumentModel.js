// CORE TRUTH MODEL — NO REACT, NO DOM.
//
// One source of truth: Document → Page → Object.
// Objects live INSIDE the page that owns them (page.objects). There is no
// `page` number and no separate `pageId` to reconcile — containment IS the
// relationship. Reorder/insert/delete pages and objects move with them for free.
//
// Two object families (the distinction the whole rebuild hinges on):
//   - kind: 'overlay'  → drawn ON TOP of original content (highlight, draw,
//                        signature, added text, stamp, image). Annotations.
//   - kind: 'content'  → operates ON original content (redaction that removes
//                        underlying operators; text-edit that replaces a run).
// Overlays are easy and ship first. Content edits are the hard, valuable part
// and get built last, once the model is proven.

import { makeId } from '../utils/id';

export function createDocument(pages = []) {
  return {
    id: makeId(),
    pages,
  };
}

export function createPage({ width, height, rotation = 0 }) {
  return {
    id: makeId(),
    width,
    height,
    rotation,
    objects: [],
  };
}

// Base object factory. Coordinates are PDF points in the OWNING page's space
// (origin bottom-left). Screen coords are computed by the render projection,
// never stored here.
function baseObject(type, kind, props = {}) {
  return {
    id: makeId(),
    type,
    kind, // 'overlay' | 'content'
    pdfX: 0,
    pdfY: 0,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 0,
    ...props,
  };
}

// --- Overlay objects (annotations — drawn on top) ---

export function createTextObject(props) {
  return baseObject('text', 'overlay', {
    text: '',
    fontSize: 16,
    fontFamily: 'Helvetica',
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    alignment: 'left',
    lineHeight: 1.2,
    opacity: 1,
    ...props,
  });
}

export function createRectObject(props) {
  return baseObject('rect', 'overlay', props);
}

export function createHighlightObject(props) {
  return baseObject('highlight', 'overlay', {
    color: '#c9a84c',
    opacity: 0.35,
    ...props,
  });
}

export function createDrawObject(props) {
  return baseObject('drawing', 'overlay', {
    pdfPoints: [],
    color: '#000000',
    lineWidth: 2,
    ...props,
  });
}

export function createSignatureObject(props) {
  return baseObject('signature', 'overlay', {
    dataUrl: null,
    opacity: 1,
    ...props,
  });
}

export function createImageObject(props) {
  return baseObject('image', 'overlay', {
    dataUrl: null,
    opacity: 1,
    ...props,
  });
}

// --- Content objects (operate on original content — built later) ---

export function createRedactionObject(props) {
  return baseObject('redaction', 'content', props);
}
