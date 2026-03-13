/**
 * ToolManager — MilPDF 2.0
 *
 * Plain JS class, instantiated via useRef in PDFViewer so it persists across renders.
 *
 * Each tool reads fresh state from `ctx` (a ref updated every render):
 *   ctx.current = { page, zoom, pageHeight, signatureDataUrl,
 *                   addObject, updateObject, deleteObject,
 *                   setPreview, clearPreview,
 *                   requestSignature, applyCrop }
 *
 * Tools communicate live UI state back to React via ctx.setPreview(state|null).
 * Preview state shape (union):
 *   null                          — no preview
 *   { type:'rect', style, x,y,w,h }
 *   { type:'polyline', points }
 *   { type:'text-input', x,y,text }
 *   { type:'edit-input', x,y,w,h,text }
 *   { type:'crop', x,y,w,h, confirmed }
 *   { type:'selected', id, screenLeft, screenTop, screenWidth, screenHeight }
 *
 * All coordinates inside preview are in screen space (CSS pixels from canvas top-left).
 */

import {
  createTextObject, createHighlightObject, createRedactObject,
  createWhiteoutObject, createSignatureObject, createDrawingObject,
} from '../EditorObject.js';
import { screenRectToPdf, screenToPdf, pdfRectToScreen } from '../coordinates.js';

// ─── Base Tool ────────────────────────────────────────────────────────────────

class BaseTool {
  constructor(ctx) {
    this.ctx = ctx; // mutable ref — always current
  }
  onMouseDown(_E, _POS) { void _E; void _POS; }
  onMouseMove(_E, _POS) { void _E; void _POS; }
  onMouseUp(_E, _POS) { void _E; void _POS; }
  onClick(_E, _POS) { void _E; void _POS; }
  activate() {}
  deactivate() { this.ctx.current.clearPreview(); }
}

// ─── Select Tool ──────────────────────────────────────────────────────────────

class SelectTool extends BaseTool {
  constructor(ctx) {
    super(ctx);
    this._dragging = null;   // { id, offsetPdfX, offsetPdfY }
    this._resizing = null;   // { id, handle, origObj, startScreen }
    this._selectedId = null;
  }

  _findObject(pos) {
    const { page, zoom, pageHeight, getObjects } = this.ctx.current;
    const objs = getObjects(page);
    // Hit test in reverse z-order (topmost first)
    for (let i = objs.length - 1; i >= 0; i--) {
      const obj = objs[i];
      const { screenLeft, screenTop, screenWidth, screenHeight } =
        pdfRectToScreen(obj.pdfX, obj.pdfY, Math.max(obj.width, 20), Math.max(obj.height, 20), pageHeight, zoom);
      // Extra padding for text (width=0)
      const pad = obj.type === 'text' ? 100 : 0;
      if (
        pos.x >= screenLeft - 4 &&
        pos.x <= screenLeft + screenWidth + pad + 4 &&
        pos.y >= screenTop - 4 &&
        pos.y <= screenTop + screenHeight + 4
      ) {
        return obj;
      }
    }
    return null;
  }

  _handleForPos(pos, obj) {
    // Returns 'tl','tr','bl','br' or null
    const { zoom, pageHeight } = this.ctx.current;
    const { screenLeft, screenTop, screenWidth, screenHeight } =
      pdfRectToScreen(obj.pdfX, obj.pdfY, obj.width || 20, obj.height || 20, pageHeight, zoom);
    const handles = {
      tl: { x: screenLeft, y: screenTop },
      tr: { x: screenLeft + screenWidth, y: screenTop },
      bl: { x: screenLeft, y: screenTop + screenHeight },
      br: { x: screenLeft + screenWidth, y: screenTop + screenHeight },
    };
    for (const [name, h] of Object.entries(handles)) {
      if (Math.abs(pos.x - h.x) <= 8 && Math.abs(pos.y - h.y) <= 8) return name;
    }
    return null;
  }

  onMouseDown(_E, pos) {
    void _E;
    const { page, zoom, pageHeight, getObjects } = this.ctx.current;

    // Check resize handle first (requires selected object)
    if (this._selectedId) {
      const objs = getObjects(page);
      const sel = objs.find(o => o.id === this._selectedId);
      if (sel && sel.width > 0) {
        const handle = this._handleForPos(pos, sel);
        if (handle) {
          this._resizing = { id: sel.id, handle, origObj: { ...sel }, startScreen: { ...pos } };
          return;
        }
      }
    }

    const obj = this._findObject(pos);
    if (obj) {
      this._selectedId = obj.id;
      // Compute drag offset in PDF space
      const { pdfX: clickPdfX, pdfY: clickPdfY } = screenToPdf(pos.x, pos.y, pageHeight, zoom);
      this._dragging = {
        id: obj.id,
        offsetPdfX: clickPdfX - obj.pdfX,
        offsetPdfY: clickPdfY - obj.pdfY,
      };
      this._emitSelected(obj);
    } else {
      this._selectedId = null;
      this.ctx.current.clearPreview();
    }
  }

  onMouseMove(_E, pos) {
    void _E;
    const { zoom, pageHeight, updateObject, getObjects, page } = this.ctx.current;

    if (this._resizing) {
      const { id, handle, origObj, startScreen } = this._resizing;
      const dx = (pos.x - startScreen.x) / zoom;
      const dy = (pos.y - startScreen.y) / zoom; // screen dy, positive = downward
      let { pdfX, pdfY, width, height } = origObj;

      // In PDF space, y increases upward, so downward screen movement = negative pdf dy
      if (handle === 'br') {
        width = Math.max(10, origObj.width + dx);
        height = Math.max(10, origObj.height - dy); // downward shrinks height
        pdfY = origObj.pdfY + origObj.height - height;
      } else if (handle === 'bl') {
        const newW = Math.max(10, origObj.width - dx);
        pdfX = origObj.pdfX + origObj.width - newW;
        width = newW;
        height = Math.max(10, origObj.height - dy);
        pdfY = origObj.pdfY + origObj.height - height;
      } else if (handle === 'tr') {
        width = Math.max(10, origObj.width + dx);
        height = Math.max(10, origObj.height + dy);
      } else if (handle === 'tl') {
        const newW = Math.max(10, origObj.width - dx);
        pdfX = origObj.pdfX + origObj.width - newW;
        width = newW;
        height = Math.max(10, origObj.height + dy);
      }

      updateObject(id, { pdfX, pdfY, width, height });
      // Update selection preview
      const objs = getObjects(page);
      const obj = objs.find(o => o.id === id);
      if (obj) this._emitSelected({ ...obj, pdfX, pdfY, width, height });
      return;
    }

    if (this._dragging) {
      const { id, offsetPdfX, offsetPdfY } = this._dragging;
      const { pdfX, pdfY } = screenToPdf(pos.x, pos.y, pageHeight, zoom);
      updateObject(id, {
        pdfX: pdfX - offsetPdfX,
        pdfY: pdfY - offsetPdfY,
      });
      // Update selection preview
      const objs = getObjects(page);
      const obj = objs.find(o => o.id === id);
      if (obj) this._emitSelected({
        ...obj,
        pdfX: pdfX - offsetPdfX,
        pdfY: pdfY - offsetPdfY,
      });
    }
  }

  onMouseUp(_E, _POS) {
    void _E;
    void _POS;
    this._dragging = null;
    this._resizing = null;
  }

  _emitSelected(obj) {
    const { zoom, pageHeight, setPreview } = this.ctx.current;
    const { screenLeft, screenTop, screenWidth, screenHeight } =
      pdfRectToScreen(obj.pdfX, obj.pdfY, Math.max(obj.width, 20), obj.height || 20, pageHeight, zoom);
    setPreview({
      type: 'selected',
      id: obj.id,
      screenLeft,
      screenTop,
      screenWidth: obj.type === 'text' ? Math.max(screenWidth, 80) : screenWidth,
      screenHeight,
    });
  }

  deactivate() {
    this._dragging = null;
    this._resizing = null;
    this._selectedId = null;
    this.ctx.current.clearPreview();
  }
}

// ─── Text Tool ────────────────────────────────────────────────────────────────

class TextTool extends BaseTool {
  onClick(_E, pos) {
    void _E;
    const { setPreview } = this.ctx.current;
    setPreview({ type: 'text-input', x: pos.x, y: pos.y, text: '' });
  }

  submitText(text) {
    if (!text.trim()) { this.ctx.current.clearPreview(); return; }
    const { page, zoom, pageHeight, addObject, clearPreview } = this.ctx.current;
    const preview = this.ctx.current.getPreview();
    if (!preview) return;
    const fontSize = 16;
    // pdfY: text baseline. In PDF, drawText y is the baseline.
    // We place baseline at (screenY / zoom) below the top of page.
    const pdfX = preview.x / zoom;
    const pdfY = pageHeight - preview.y / zoom - fontSize;
    addObject(createTextObject(page, pdfX, pdfY, text, fontSize));
    clearPreview();
  }
}

// ─── Highlight Tool ───────────────────────────────────────────────────────────

class RectDragTool extends BaseTool {
  constructor(ctx, previewStyle, minSize = 5) {
    super(ctx);
    this._start = null;
    this._previewStyle = previewStyle;
    this._minSize = minSize;
  }

  onMouseDown(_E, pos) {
    void _E;
    this._start = pos;
    this.ctx.current.setPreview({ type: 'rect', style: this._previewStyle, x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  onMouseMove(_E, pos) {
    void _E;
    if (!this._start) return;
    const x = Math.min(this._start.x, pos.x);
    const y = Math.min(this._start.y, pos.y);
    const w = Math.abs(pos.x - this._start.x);
    const h = Math.abs(pos.y - this._start.y);
    this.ctx.current.setPreview({ type: 'rect', style: this._previewStyle, x, y, w, h });
  }

  onMouseUp(_E, _POS) {
    void _E;
    void _POS;
    const preview = this.ctx.current.getPreview();
    if (preview && preview.w > this._minSize && preview.h > this._minSize) {
      this._onComplete(preview);
    }
    this._start = null;
    this.ctx.current.clearPreview();
  }

  _onComplete(_RECT) { void _RECT; } // override in subclass
  deactivate() { this._start = null; this.ctx.current.clearPreview(); }
}

class HighlightTool extends RectDragTool {
  constructor(ctx) { super(ctx, 'highlight'); }
  _onComplete(rect) {
    const { page, zoom, pageHeight, addObject } = this.ctx.current;
    const { pdfX, pdfY, pdfWidth, pdfHeight } = screenRectToPdf(rect.x, rect.y, rect.w, rect.h, pageHeight, zoom);
    addObject(createHighlightObject(page, pdfX, pdfY, pdfWidth, pdfHeight));
  }
}

class RedactTool extends RectDragTool {
  constructor(ctx) { super(ctx, 'redact'); }
  _onComplete(rect) {
    const { page, zoom, pageHeight, addObject } = this.ctx.current;
    const { pdfX, pdfY, pdfWidth, pdfHeight } = screenRectToPdf(rect.x, rect.y, rect.w, rect.h, pageHeight, zoom);
    addObject(createRedactObject(page, pdfX, pdfY, pdfWidth, pdfHeight));
  }
}

// ─── Draw Tool ────────────────────────────────────────────────────────────────

class DrawTool extends BaseTool {
  constructor(ctx) {
    super(ctx);
    this._points = null;
  }

  onMouseDown(_E, pos) {
    void _E;
    this._points = [pos];
    this.ctx.current.setPreview({ type: 'polyline', points: [pos] });
  }

  onMouseMove(_E, pos) {
    void _E;
    if (!this._points) return;
    this._points.push(pos);
    this.ctx.current.setPreview({ type: 'polyline', points: this._points });
  }

  onMouseUp(_E, _POS) {
    void _E;
    void _POS;
    if (this._points && this._points.length > 2) {
      const { page, zoom, pageHeight, addObject } = this.ctx.current;
      const pdfPoints = this._points.map(p => screenToPdf(p.x, p.y, pageHeight, zoom));
      addObject(createDrawingObject(page, pdfPoints, '#000000', 2));
    }
    this._points = null;
    this.ctx.current.clearPreview();
  }

  deactivate() { this._points = null; this.ctx.current.clearPreview(); }
}

// ─── Signature Tool ───────────────────────────────────────────────────────────

class SignatureTool extends BaseTool {
  onClick(_E, pos) {
    void _E;
    const { page, zoom, pageHeight, signatureDataUrl, addObject, requestSignature } = this.ctx.current;
    if (!signatureDataUrl) { requestSignature(); return; }
    const sigW = 200 / zoom;
    const sigH = 80 / zoom;
    const { pdfX, pdfY } = screenToPdf(pos.x, pos.y, pageHeight, zoom);
    addObject(createSignatureObject(page, pdfX, pdfY - sigH, sigW, sigH, signatureDataUrl));
  }
}

// ─── Crop Tool ────────────────────────────────────────────────────────────────

class CropTool extends RectDragTool {
  constructor(ctx) { super(ctx, 'crop', 10); }

  _onComplete(rect) {
    // Don't auto-apply — show "Apply / Cancel" buttons (preview stays visible)
    this.ctx.current.setPreview({
      type: 'crop',
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      confirmed: false,
    });
  }

  // Called by PDFViewer when user clicks "Apply Crop"
  applyConfirmed(preview) {
    const { zoom, applyCrop, clearPreview } = this.ctx.current;
    applyCrop({ x: preview.x, y: preview.y, width: preview.w, height: preview.h, scale: zoom });
    clearPreview();
  }

  onMouseUp(_E, _POS) {
    void _E;
    void _POS;
    const preview = this.ctx.current.getPreview();
    if (preview && preview.w > 10 && preview.h > 10) {
      this._onComplete(preview);
    } else {
      this._start = null;
      this.ctx.current.clearPreview();
    }
    this._start = null;
  }
}

// ─── Edit Tool (Whiteout + replacement text) ──────────────────────────────────

class EditTool extends RectDragTool {
  constructor(ctx) { super(ctx, 'whiteout'); }

  _onComplete(rect) {
    // Show edit-input overlay
    this.ctx.current.setPreview({
      type: 'edit-input',
      x: rect.x, y: rect.y, w: rect.w, h: rect.h, text: '',
    });
  }

  submitEdit(preview) {
    const { page, zoom, pageHeight, addObject, clearPreview } = this.ctx.current;
    // Always create whiteout rect
    const { pdfX, pdfY, pdfWidth, pdfHeight } = screenRectToPdf(preview.x, preview.y, preview.w, preview.h, pageHeight, zoom);
    addObject(createWhiteoutObject(page, pdfX, pdfY, pdfWidth, pdfHeight));
    // Replacement text (if any)
    if (preview.text && preview.text.trim()) {
      const fontSize = Math.min(16, Math.max(10, Math.round(preview.h * 0.6 / zoom)));
      const tPdfX = pdfX + 4 / zoom;
      const tPdfY = pdfY + pdfHeight - fontSize;
      addObject(createTextObject(page, tPdfX, tPdfY, preview.text, fontSize));
    }
    clearPreview();
  }
}

// ─── ToolManager ──────────────────────────────────────────────────────────────

export class ToolManager {
  constructor(ctx) {
    this._ctx = ctx;
    this._activeName = 'select';
    this._tools = {
      select:    new SelectTool(ctx),
      text:      new TextTool(ctx),
      highlight: new HighlightTool(ctx),
      redact:    new RedactTool(ctx),
      draw:      new DrawTool(ctx),
      signature: new SignatureTool(ctx),
      crop:      new CropTool(ctx),
      edit:      new EditTool(ctx),
    };
  }

  get activeTool() { return this._tools[this._activeName]; }
  get activeToolName() { return this._activeName; }

  setTool(name) {
    if (!this._tools[name]) return;
    this._tools[this._activeName].deactivate?.();
    this._activeName = name;
    this._tools[name].activate?.();
  }

  onMouseDown(e, pos) { this.activeTool.onMouseDown(e, pos); }
  onMouseMove(e, pos) { this.activeTool.onMouseMove(e, pos); }
  onMouseUp(e, pos)   { this.activeTool.onMouseUp(e, pos); }
  onClick(e, pos)     { this.activeTool.onClick(e, pos); }

  // Proxy to specific tools for UI callbacks
  submitText(text)      { this._tools.text.submitText(text); }
  submitEdit(preview)   { this._tools.edit.submitEdit(preview); }
  applyCrop(preview)    { this._tools.crop.applyConfirmed(preview); }
  getSelectedId()       { return this._tools.select._selectedId; }
  clearSelection()      { this._tools.select._selectedId = null; }
  deleteSelected()      {
    const id = this._tools.select._selectedId;
    if (id) {
      this._ctx.current.deleteObject(id);
      this._tools.select._selectedId = null;
      this._ctx.current.clearPreview();
    }
  }
}



