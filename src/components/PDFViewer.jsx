import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FileSearch } from 'lucide-react';
import { renderPageToCanvas } from '../utils/pdfUtils';
import { ToolManager } from '../editor/tools/ToolManager.js';
import { pdfRectToScreen } from '../editor/coordinates.js';

/**
 * PDFViewer — MilPDF 2.0
 *
 * Rendering: PDF.js → <canvas>
 * Objects:   EditorObjects (PDF-space coords) rendered as HTML overlays
 * Events:    routed through ToolManager — no inline tool branching here
 */
export default function PDFViewer({
  renderDoc, currentPage, zoom, activeTool,
  objects,              // EditorObject[] — all pages (scene graph flat array)
  onAddObject,
  onDeleteObject,
  onUpdateObject,
  signatureDataUrl,
  onRequestSignature,
  onCropApply,
  onCropCancel,
  onDropFile,
  watermarkText,
}) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const pageHeightRef = useRef(792); // PDF points; updated after each render

  // Preview state: live tool feedback (rect outlines, drawing path, input overlays, etc.)
  const [toolPreview, setToolPreview] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Mutable context ref that ToolManager reads on every event ──────────────
  const ctxRef = useRef({});

  // Build the ToolManager once
  const toolManager = useRef(null);
  if (!toolManager.current) {
    toolManager.current = new ToolManager(ctxRef);
  }

  // Update context every render so tools always see fresh values
  const pageObjects = useMemo(
    () => objects.filter(o => o.page === currentPage),
    [objects, currentPage]
  );

  ctxRef.current = {
    page: currentPage,
    zoom,
    get pageHeight() { return pageHeightRef.current; },
    signatureDataUrl,
    getObjects: (page) => objects.filter(o => o.page === page),
    getPreview: () => toolPreview,

    addObject:    (obj) => onAddObject(obj),
    deleteObject: (id)  => onDeleteObject(id),
    updateObject: (id, updates) => onUpdateObject(id, updates),

    setPreview:   (state) => setToolPreview(state),
    clearPreview: ()      => setToolPreview(null),

    requestSignature: () => onRequestSignature(),
    applyCrop: (cropBox) => onCropApply(cropBox),
  };

  // ── Render PDF page to canvas ──────────────────────────────────────────────
  useEffect(() => {
    if (renderDoc && canvasRef.current) {
      renderPageToCanvas(renderDoc, currentPage, canvasRef.current, zoom)
        .then(({ height }) => {
          // height is canvas px; divide by zoom to get PDF points
          pageHeightRef.current = height / zoom;
        })
        .catch(console.error);
    }
  }, [renderDoc, currentPage, zoom]);

  // ── Sync active tool to ToolManager ───────────────────────────────────────
  useEffect(() => {
    toolManager.current.setTool(activeTool);
  }, [activeTool]);

  // ── Canvas coordinate helper ───────────────────────────────────────────────
  const getCanvasPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ── Mouse event routing ────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (!canvasRef.current) return;
    toolManager.current.onMouseDown(e, getCanvasPos(e));
  }, [getCanvasPos]);

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    toolManager.current.onMouseMove(e, getCanvasPos(e));
  }, [getCanvasPos]);

  const handleMouseUp = useCallback((e) => {
    toolManager.current.onMouseUp(e, getCanvasPos(e));
  }, [getCanvasPos]);

  const handleCanvasClick = useCallback((e) => {
    if (!canvasRef.current) return;
    // Skip click for drag-type tools (handled via mousedown/up)
    if (['highlight', 'redact', 'crop', 'draw', 'edit'].includes(activeTool)) return;
    toolManager.current.onClick(e, getCanvasPos(e));
  }, [activeTool, getCanvasPos]);

  // ── Keyboard: Delete selected object ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Delete' && activeTool === 'select' && !e.target.closest('input,textarea')) {
        toolManager.current.deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTool]);

  // ── Drag-and-drop file ─────────────────────────────────────────────────────
  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') onDropFile(file);
  }, [onDropFile]);

  // ── Object screen bounds helper ────────────────────────────────────────────
  const objBounds = useCallback((obj) => {
    const ph = pageHeightRef.current;
    return pdfRectToScreen(obj.pdfX, obj.pdfY, Math.max(obj.width, 1), obj.height, ph, zoom);
  }, [zoom]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!renderDoc) {
    return (
      <div
        className={`pdf-viewer empty ${isDragOver ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="empty-message">
          <FileSearch size={64} strokeWidth={1.2} className="empty-icon" />
          <h2>Open a PDF to get started</h2>
          <p>Click &ldquo;Open&rdquo; in the toolbar, or drag &amp; drop a PDF here</p>
        </div>
      </div>
    );
  }

  // Derived preview state values
  const isRectPreview = toolPreview?.type === 'rect';
  const isCropPreview = toolPreview?.type === 'crop';
  const isPolyPreview = toolPreview?.type === 'polyline';
  const isTextInput   = toolPreview?.type === 'text-input';
  const isEditInput   = toolPreview?.type === 'edit-input';
  const isSelected    = toolPreview?.type === 'selected';

  return (
    <div
      className={`pdf-viewer ${isDragOver ? 'drag-active' : ''}`}
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="canvas-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={`pdf-canvas tool-${activeTool}`}
        />

        {/* ── EditorObject overlays ─────────────────────────────────────── */}
        {pageObjects.map(obj => {
          const ph = pageHeightRef.current;

          if (obj.type === 'drawing') {
            const pts = (obj.pdfPoints || []).map(p => {
              const { screenX, screenY } = { screenX: p.x * zoom, screenY: (ph - p.y) * zoom };
              return `${screenX},${screenY}`;
            });
            return (
              <svg key={obj.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <polyline
                  points={pts.join(' ')}
                  fill="none"
                  stroke={obj.color || '#000'}
                  strokeWidth={obj.lineWidth || 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          }

          const { screenLeft, screenTop, screenWidth, screenHeight } = objBounds(obj);

          return (
            <div
              key={obj.id}
              className={`annotation annotation-${obj.type} ${activeTool === 'select' ? 'draggable' : ''}`}
              style={{
                left: screenLeft,
                top:  screenTop,
                width:  obj.width > 0 ? screenWidth : undefined,
                height: obj.height > 0 ? screenHeight : undefined,
              }}
              onMouseDown={(e) => {
                if (activeTool === 'select') {
                  // Let ToolManager handle — just stop propagation to canvas
                  e.stopPropagation();
                  toolManager.current.onMouseDown(e, getCanvasPos(e));
                }
              }}
            >
              {obj.type === 'text' && (
                <span style={{ fontSize: `${(obj.fontSize || 16) * zoom}px`, whiteSpace: 'nowrap' }}>
                  {obj.text}
                </span>
              )}
              {obj.type === 'signature' && (
                <img src={obj.dataUrl} alt="Signature" draggable={false}
                  style={{ width: '100%', height: '100%' }} />
              )}
              <button
                className="annotation-delete"
                onClick={(e) => { e.stopPropagation(); onDeleteObject(obj.id); }}
                title="Remove"
              >×</button>
            </div>
          );
        })}

        {/* ── Selection handles (SelectTool) ────────────────────────────── */}
        {isSelected && (() => {
          const { screenLeft: sl, screenTop: st, screenWidth: sw, screenHeight: sh } = toolPreview;
          // Only show resize handles if the object has dimensions
          const selObj = pageObjects.find(o => o.id === toolPreview.id);
          const canResize = selObj && selObj.width > 0 && selObj.height > 0;
          const handles = canResize
            ? [['tl', sl, st], ['tr', sl + sw, st], ['bl', sl, st + sh], ['br', sl + sw, st + sh]]
            : [];
          return (
            <>
              <div className="selection-box" style={{ left: sl, top: st, width: sw, height: sh }} />
              {handles.map(([name, hx, hy]) => (
                <div key={name} className={`resize-handle resize-handle-${name}`}
                  style={{ left: hx - 5, top: hy - 5 }} />
              ))}
            </>
          );
        })()}

        {/* ── Live rect preview (highlight, redact, whiteout) ──────────── */}
        {isRectPreview && (
          <div
            className={`${toolPreview.style}-overlay`}
            style={{ left: toolPreview.x, top: toolPreview.y, width: toolPreview.w, height: toolPreview.h }}
          />
        )}

        {/* ── Live freehand drawing ─────────────────────────────────────── */}
        {isPolyPreview && toolPreview.points.length > 1 && (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <polyline
              points={toolPreview.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="#000" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        )}

        {/* ── Crop rectangle ────────────────────────────────────────────── */}
        {isCropPreview && (
          <>
            <div className="crop-overlay" style={{
              left: toolPreview.x, top: toolPreview.y,
              width: toolPreview.w, height: toolPreview.h,
            }} />
            <div className="crop-actions" style={{
              left: toolPreview.x,
              top: toolPreview.y + toolPreview.h + 8,
            }}>
              <button onClick={() => toolManager.current.applyCrop(toolPreview)}>Apply Crop</button>
              <button onClick={() => { setToolPreview(null); onCropCancel(); }}>Cancel</button>
            </div>
          </>
        )}

        {/* ── Edit (whiteout) text input ────────────────────────────────── */}
        {isEditInput && (
          <div className="edit-input-overlay" style={{
            left: toolPreview.x, top: toolPreview.y,
            width: toolPreview.w, height: toolPreview.h,
          }}>
            <input
              type="text"
              autoFocus
              value={toolPreview.text}
              onChange={(e) => setToolPreview({ ...toolPreview, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') toolManager.current.submitEdit(toolPreview);
                if (e.key === 'Escape') setToolPreview(null);
              }}
              onBlur={() => toolManager.current.submitEdit(toolPreview)}
              placeholder="Replacement text (optional)..."
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}

        {/* ── Text input overlay ────────────────────────────────────────── */}
        {isTextInput && (
          <div className="text-input-overlay" style={{ left: toolPreview.x, top: toolPreview.y }}>
            <input
              type="text"
              autoFocus
              value={toolPreview.text}
              onChange={(e) => setToolPreview({ ...toolPreview, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') toolManager.current.submitText(toolPreview.text);
                if (e.key === 'Escape') setToolPreview(null);
              }}
              onBlur={() => toolManager.current.submitText(toolPreview.text)}
              placeholder="Type text..."
            />
          </div>
        )}

        {/* ── Watermark overlay ─────────────────────────────────────────── */}
        {watermarkText && (
          <div className="watermark-overlay">
            <span>{watermarkText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
