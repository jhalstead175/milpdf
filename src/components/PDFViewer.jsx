import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FileSearch } from 'lucide-react';
import usePageCache from '../hooks/usePageCache';
import { makeId } from '../utils/id';
import { identityTransform, transformToCSS, transformedBounds } from '../editor/Transform';
import { createToolRegistry } from '../core/tools';
import { createInteractionState } from '../core/interaction/state';
import { RENDER_LAYERS } from '../core/rendering/layers';
import { startResize, startRotate } from '../core/transform';
import {
  alignLeft, alignRight, alignTop, alignBottom,
  alignCenterH, alignCenterV,
  distributeHorizontally, distributeVertically,
} from '../editor/alignment';

/**
 * PDFViewer — MilPDF 2.0
 *
 * Rendering: PDF.js + <canvas>
 * Objects:   EditorObjects (PDF-space coords) rendered as HTML overlays
 * Events:    handled inline per active tool
 */
export default function PDFViewer({
  renderDoc, currentPage, zoom, activeTool,
  objects = [],
  pageObjects = [],
  layers = {},
  selectionIds = [],
  interactionState,
  setInteractionState,
  onSelectionChange,
  onAddObject, onDeleteObject, onUpdateObject, onBatchUpdateObjects,
  signatureDataUrl, onRequestSignature,
  onCropApply, onCropCancel,
  onDropFile, watermarkText,
  imagePlacement,
  onImagePlaced,
  onImagePlacementCancel,
}) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);

  const textAreaRef = useRef(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const { getPage } = usePageCache(renderDoc, zoom);

  const [textBoxRect, setTextBoxRect] = useState(null);
  const [textBoxStart, setTextBoxStart] = useState(null);
  const [textInput, setTextInput] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [cropStart, setCropStart] = useState(null);
  const [highlightRect, setHighlightRect] = useState(null);
  const [highlightStart, setHighlightStart] = useState(null);
  const [redactRect, setRedactRect] = useState(null);
  const [redactStart, setRedactStart] = useState(null);
  const [drawingPoints, setDrawingPoints] = useState(null);
  const [imageRect, setImageRect] = useState(null);
  const [imageStart, setImageStart] = useState(null);
  const [selection, setSelection] = useState(() => new Set(selectionIds));
  const [snapGuides, setSnapGuides] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editRect, setEditRect] = useState(null);
  const [editStart, setEditStart] = useState(null);
  const [editInput, setEditInput] = useState(null);
  const [nativeAnnotations, setNativeAnnotations] = useState([]);
  const visibleObjects = useMemo(() => (
    pageObjects
      .filter(o => o.visible !== false)
      .filter(o => layers?.[o.layerId]?.visible !== false)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  ), [pageObjects, layers]);

  const pdfPageHeight = pageSize.height ? pageSize.height / zoom : 0;
  const pdfPageWidth = pageSize.width ? pageSize.width / zoom : 0;

  useEffect(() => {
    setSelection(new Set(selectionIds));
  }, [selectionIds]);

  useEffect(() => {
    setSelection(prev => {
      const next = new Set([...prev].filter(id => objects.some(o => o.id === id)));
      if (onSelectionChange) onSelectionChange([...next]);
      return next;
    });
  }, [objects, onSelectionChange]);

  useEffect(() => {
    let cancelled = false;
    if (renderDoc && canvasRef.current) {
      getPage(currentPage).then(entry => {
        if (!entry || cancelled) return;
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = entry.width;
        canvasRef.current.height = entry.height;
        ctx.clearRect(0, 0, entry.width, entry.height);
        ctx.drawImage(entry.bitmap, 0, 0);
        setPageSize({ width: entry.width, height: entry.height });
      }).catch(console.error);
    }
    return () => { cancelled = true; };
  }, [renderDoc, currentPage, zoom, getPage]);

  useEffect(() => {
    if (!renderDoc) return;
    let cancelled = false;
    renderDoc.getPage(currentPage).then(async page => {
      const annotations = await page.getAnnotations();
      if (!cancelled) setNativeAnnotations(annotations || []);
    });
    return () => { cancelled = true; };
  }, [renderDoc, currentPage]);

  useEffect(() => {
    if (activeTool !== 'crop') { setCropRect(null); setCropStart(null); }
    if (activeTool !== 'highlight') { setHighlightRect(null); setHighlightStart(null); }
    if (activeTool !== 'redact') { setRedactRect(null); setRedactStart(null); }
    if (activeTool !== 'draw') { setDrawingPoints(null); }
    if (activeTool !== 'image') { setImageRect(null); setImageStart(null); }
    if (activeTool !== 'edit') { setEditRect(null); setEditStart(null); setEditInput(null); }
    if (activeTool !== 'text') { setTextBoxRect(null); setTextBoxStart(null); setTextInput(null); }
    if (activeTool !== 'select' && setInteractionState) { setInteractionState(createInteractionState()); }
  }, [activeTool, setInteractionState]);
  const getCanvasPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);


  const screenRectToPdf = useCallback((x, y, width, height) => {
    const pdfX = x / zoom;
    const pdfY = pdfPageHeight - (y / zoom) - (height / zoom);
    return { pdfX, pdfY, width: width / zoom, height: height / zoom };
  }, [zoom, pdfPageHeight]);

  const pdfRectToScreen = useCallback((pdfX, pdfY, width, height) => ({
    left: pdfX * zoom,
    top: (pdfPageHeight - (pdfY + height)) * zoom,
    width: width * zoom,
    height: height * zoom,
  }), [zoom, pdfPageHeight]);

  const screenToPdfPoint = useCallback((x, y) => ({
    x: x / zoom,
    y: pdfPageHeight - y / zoom,
  }), [zoom, pdfPageHeight]);

  const getNextZIndex = useCallback((layerId) => {
    let max = 0;
    for (const obj of objects) {
      if (obj.layerId === layerId) max = Math.max(max, obj.zIndex ?? 0);
    }
    return max + 1;
  }, [objects]);

  const createBaseObject = useCallback((type, rect, layerId, extra = {}) => ({
    id: makeId(),
    type,
    page: currentPage,
    pdfX: rect.pdfX,
    pdfY: rect.pdfY,
    width: rect.width,
    height: rect.height,
    transform: identityTransform(),
    zIndex: getNextZIndex(layerId),
    groupId: null,
    locked: false,
    visible: true,
    name: extra.name ?? type,
    opacity: extra.opacity ?? 1,
    layerId,
    ...extra,
  }), [currentPage, getNextZIndex]);

  const renderObjects = useMemo(() => {
    if (!interactionState.dragPreview || interactionState.dragPreview.size === 0) return visibleObjects;
    return visibleObjects.map(obj => {
      const preview = interactionState.dragPreview.get(obj.id);
      return preview ? {
        ...obj,
        pdfX: preview.pdfX ?? obj.pdfX,
        pdfY: preview.pdfY ?? obj.pdfY,
        width: preview.width ?? obj.width,
        height: preview.height ?? obj.height,
        transform: preview.transform ?? obj.transform,
      } : obj;
    });
  }, [visibleObjects, interactionState.dragPreview]);

  const selectedObjects = useMemo(
    () => renderObjects.filter(o => selection.has(o.id)),
    [renderObjects, selection]
  );

  const selectionBounds = useMemo(() => {
    if (selectedObjects.length === 0) return null;
    const bounds = selectedObjects.map(obj => transformedBounds(obj));
    const xs = bounds.map(b => b.pdfX);
    const ys = bounds.map(b => b.pdfY);
    const x2 = bounds.map(b => b.pdfX + b.width);
    const y2 = bounds.map(b => b.pdfY + b.height);
    return {
      pdfX: Math.min(...xs),
      pdfY: Math.min(...ys),
      width: Math.max(...x2) - Math.min(...xs),
      height: Math.max(...y2) - Math.min(...ys),
    };
  }, [selectedObjects]);

  const applyAlignment = useCallback((type) => {
    if (!onBatchUpdateObjects) return;
    const ids = new Set(selection);
    let patches = [];
    if (type === 'left') patches = alignLeft(objects, ids);
    else if (type === 'right') patches = alignRight(objects, ids);
    else if (type === 'top') patches = alignTop(objects, ids);
    else if (type === 'bottom') patches = alignBottom(objects, ids);
    else if (type === 'centerH') patches = alignCenterH(objects, ids);
    else if (type === 'centerV') patches = alignCenterV(objects, ids);
    else if (type === 'distributeH') patches = distributeHorizontally(objects, ids);
    else if (type === 'distributeV') patches = distributeVertically(objects, ids);
    if (patches.length > 0) onBatchUpdateObjects(patches);
  }, [onBatchUpdateObjects, selection, objects]);
  const findObjectAt = useCallback((pos) => {
    const sorted = [...renderObjects].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
    for (const obj of sorted) {
      if (obj.locked) continue;
      if (layers?.[obj.layerId]?.locked) continue;
      const bounds = transformedBounds(obj);
      const width = Math.max(bounds.width, (obj.fontSize || 12) * 0.6);
      const height = Math.max(bounds.height, obj.fontSize || 12);
      const screen = pdfRectToScreen(bounds.pdfX, bounds.pdfY, width, height);
      const hitPad = 6;
      const hit = {
        left: screen.left - hitPad / 2,
        top: screen.top - hitPad / 2,
        width: screen.width + hitPad,
        height: screen.height + hitPad,
      };
      if (
        pos.x >= hit.left &&
        pos.x <= hit.left + hit.width &&
        pos.y >= hit.top &&
        pos.y <= hit.top + hit.height
      ) {
        return obj;
      }
    }
    return null;
  }, [renderObjects, layers, pdfRectToScreen]);

  const toolContext = useMemo(() => ({
    selection, setSelection, onSelectionChange,
    renderObjects, visibleObjects, layers,
    interactionState, setInteractionState, setSnapGuides,
    zoom, pdfPageHeight, pdfPageWidth, screenRectToPdf,
    onBatchUpdateObjects,
    findObjectAt,
    setTextBoxStart, setTextBoxRect, textBoxStart, textBoxRect,
    setTextInput,
    setCropStart, setCropRect, cropStart,
    setHighlightStart, setHighlightRect, highlightStart, highlightRect,
    setRedactStart, setRedactRect, redactStart, redactRect,
    setDrawingPoints, drawingPoints, screenToPdfPoint,
    imagePlacement,
    setImageRect, setImageStart, imageRect, imageStart,
    onImagePlaced, onImagePlacementCancel,
    setEditStart, setEditRect, editStart, editRect, setEditInput,
    signatureDataUrl, onRequestSignature,
    createBaseObject, onAddObject,
  }), [
    selection, setSelection, onSelectionChange, renderObjects, visibleObjects, layers,
    interactionState, setInteractionState, setSnapGuides,
    zoom, pdfPageHeight, pdfPageWidth, screenRectToPdf,
    onBatchUpdateObjects,
    findObjectAt,
    setTextBoxStart, setTextBoxRect, textBoxStart, textBoxRect,
    setTextInput,
    setCropStart, setCropRect, cropStart,
    setHighlightStart, setHighlightRect, highlightStart, highlightRect,
    setRedactStart, setRedactRect, redactStart, redactRect,
    setDrawingPoints, drawingPoints, screenToPdfPoint,
    imagePlacement,
    setImageRect, setImageStart, imageRect, imageStart,
    onImagePlaced, onImagePlacementCancel,
    setEditStart, setEditRect, editStart, editRect, setEditInput,
    signatureDataUrl, onRequestSignature,
    createBaseObject, onAddObject,
  ]);

  const toolRegistry = useMemo(() => createToolRegistry(toolContext), [toolContext]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      const tool = toolRegistry[activeTool];
      if (tool?.onCancel) tool.onCancel(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toolRegistry, activeTool]);

  const handleCanvasClick = useCallback((e) => {
    if (!canvasRef.current) return;
    const tool = toolRegistry[activeTool];
    if (!tool?.onClick) return;
    const pos = getCanvasPos(e);
    tool.onClick(e, pos);
  }, [activeTool, toolRegistry, getCanvasPos]);

  const handleTextSubmit = useCallback(() => {
    if (textInput && textInput.text.trim()) {
      const width = textAreaRef.current?.offsetWidth ?? textInput.width;
      const height = textAreaRef.current?.offsetHeight ?? textInput.height;
      const rect = screenRectToPdf(textInput.x, textInput.y, width, height);
      if (textInput.existingId) {
        onUpdateObject(textInput.existingId, {
          text: textInput.text,
          width: rect.width,
          height: rect.height,
        });
      } else {
        onAddObject(createBaseObject('text', rect, 'markup', {
          text: textInput.text,
          fontSize: textInput.fontSize || 16,
          fontFamily: 'Helvetica',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          alignment: 'left',
          lineHeight: 1.2,
          autoHeight: false,
        }));
      }
    }
    setTextInput(null);
  }, [textInput, screenRectToPdf, onAddObject, onUpdateObject, createBaseObject]);

  const handleEditSubmit = useCallback(() => {
    if (editInput) {
      const rect = screenRectToPdf(editInput.x, editInput.y, editInput.width, editInput.height);
      onAddObject(createBaseObject('whiteout', rect, 'markup'));
      if (editInput.text.trim()) {
        const padding = 4;
        const textRect = screenRectToPdf(
          editInput.x + padding,
          editInput.y + padding,
          editInput.width - padding * 2,
          editInput.height - padding * 2
        );
        onAddObject(createBaseObject('text', textRect, 'markup', {
          text: editInput.text,
          fontSize: Math.min(16, Math.max(10, Math.round(textRect.height * 0.6))),
          fontFamily: 'Helvetica',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          alignment: 'left',
          lineHeight: 1.2,
          autoHeight: false,
        }));
      }
    }
    setEditInput(null);
  }, [editInput, screenRectToPdf, onAddObject, createBaseObject]);
  const handlePointerDown = useCallback((e) => {
    if (!canvasRef.current) return;
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const tool = toolRegistry[activeTool];
    if (!tool?.onMouseDown) return;
    const pos = getCanvasPos(e);
    tool.onMouseDown(e, pos);
  }, [activeTool, toolRegistry, getCanvasPos]);

  const handlePointerMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const pos = getCanvasPos(e);

    const tool = toolRegistry[activeTool];
    if (!tool?.onMouseMove) return;
    tool.onMouseMove(e, pos);
  }, [getCanvasPos, toolRegistry, activeTool]);
  const handlePointerUp = useCallback((e) => {
    const tool = toolRegistry[activeTool];
    if (tool?.onMouseUp) tool.onMouseUp(e);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, [toolRegistry, activeTool]);
  const handlePointerCancel = useCallback((e) => {
    const tool = toolRegistry[activeTool];
    if (tool?.onCancel) tool.onCancel(e);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, [toolRegistry, activeTool]);

  const handleCropApply = useCallback(() => {
    if (cropRect && cropRect.width > 10 && cropRect.height > 10) {
      onCropApply({ ...cropRect, scale: zoom });
      setCropRect(null);
    }
  }, [cropRect, onCropApply, zoom]);

  // ── Drag-and-drop file ─────────────────────────────────────────────────────
  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') onDropFile(file);
  }, [onDropFile]);

  const selectionScreen = selectionBounds
    ? pdfRectToScreen(selectionBounds.pdfX, selectionBounds.pdfY, selectionBounds.width, selectionBounds.height)
    : null;

  const showCancelHint = (
    (activeTool === 'draw' && drawingPoints?.length > 0) ||
    (activeTool === 'image' && imageRect) ||
    (activeTool === 'text' && textBoxRect) ||
    (activeTool === 'highlight' && highlightRect) ||
    (activeTool === 'redact' && redactRect) ||
    (activeTool === 'edit' && editRect) ||
    (activeTool === 'crop' && cropRect)
  );

  const handleResizeStart = useCallback((e, handle) => {
    if (!selectionBounds || !selectionScreen) return;
    e.stopPropagation();
    const pos = getCanvasPos(e);
    const nextState = startResize(selectionBounds, selectionScreen, selectedObjects, pos, handle);
    setInteractionState(prev => ({ ...prev, ...nextState }));
  }, [selectionBounds, selectionScreen, getCanvasPos, selectedObjects, setInteractionState]);

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
      >
        <div className={RENDER_LAYERS.pdf}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`pdf-canvas tool-${activeTool}`}
          />
        </div>


        <div className={RENDER_LAYERS.annotations}>
          {nativeAnnotations.length > 0 && (
            <svg
              className="native-annotation-layer"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              {nativeAnnotations.map((ann, i) => {
                if (!ann.rect) return null;
                const [x1, y1, x2, y2] = ann.rect;
                const rect = pdfRectToScreen(x1, y1, x2 - x1, y2 - y1);
                return (
                  <rect
                    key={`${ann.id || 'ann'}-${i}`}
                    x={rect.left}
                    y={rect.top}
                    width={rect.width}
                    height={rect.height}
                    fill="none"
                    stroke="rgba(200, 200, 200, 0.35)"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          )}

          {renderObjects.map(obj => {
          const rect = pdfRectToScreen(obj.pdfX, obj.pdfY, obj.width, obj.height);
          const style = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            transformOrigin: 'center center',
            transform: obj.transform ? transformToCSS(obj.transform) : undefined,
          };
          if (obj.opacity != null) style.opacity = obj.opacity;
          if (obj.type === 'highlight' && obj.color) style.backgroundColor = obj.color;
          if (obj.type === 'redact' && obj.color) style.backgroundColor = obj.color;
          if (obj.type === 'whiteout' && obj.color) style.backgroundColor = obj.color;

          if (obj.type === 'drawing') {
            return (
              <svg key={obj.id} className="annotation annotation-drawing" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <polyline
                  points={(obj.pdfPoints || []).map(p => `${p.x * zoom},${(pdfPageHeight - p.y) * zoom}`).join(' ')}
                  fill="none"
                  stroke={obj.color || '#000'}
                  strokeWidth={obj.lineWidth || 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          }


          if (obj.type === 'formField') {
            const inputStyle = {
              position: 'absolute',
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              fontSize: `${Math.min(rect.height * 0.7, 14)}px`,
              border: obj.readOnly ? 'none' : '1px solid rgba(0,100,255,0.4)',
              background: 'rgba(220,235,255,0.15)',
              boxSizing: 'border-box',
              padding: '1px 2px',
            };

            if (obj.isCheckBox) {
              return (
                <input
                  key={obj.id}
                  type="checkbox"
                  style={inputStyle}
                  checked={obj.fieldValue === 'On' || obj.fieldValue === true}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={e => onUpdateObject(obj.id, { fieldValue: e.target.checked ? 'On' : 'Off' })}
                />
              );
            }

            if (obj.fieldType === 'Tx') {
              return (
                <input
                  key={obj.id}
                  type="text"
                  style={inputStyle}
                  value={obj.fieldValue}
                  readOnly={obj.readOnly}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={e => onUpdateObject(obj.id, { fieldValue: e.target.value })}
                />
              );
            }

            if (obj.fieldType === 'Ch') {
              return (
                <select
                  key={obj.id}
                  style={inputStyle}
                  value={obj.fieldValue}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={e => onUpdateObject(obj.id, { fieldValue: e.target.value })}
                >
                  {(obj.options || []).map(o => (
                    <option key={o.exportValue} value={o.exportValue}>{o.displayValue}</option>
                  ))}
                </select>
              );
            }

            if (obj.fieldType === 'Sig') {
              return (
                <div
                  key={obj.id}
                  className="form-sig-block"
                  style={inputStyle}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onRequestSignature()}
                >
                  {obj.fieldValue ? <img src={obj.fieldValue} alt="Signature" /> : <span>Click to sign</span>}
                </div>
              );
            }
          }

          if (obj.type === 'image') {
            return (
              <div
                key={obj.id}
                className={`annotation annotation-${obj.type} ${selection.has(obj.id) ? 'selected' : ''} ${activeTool === 'select' && !obj.locked && !layers?.[obj.layerId]?.locked ? 'draggable' : ''}`}
                style={style}
              >
                <img src={obj.dataUrl} alt={obj.name || 'Image'} draggable={false} />
              </div>
            );
          }

          return (
            <div
              key={obj.id}
              className={`annotation annotation-${obj.type} ${selection.has(obj.id) ? 'selected' : ''} ${activeTool === 'select' && !obj.locked && !layers?.[obj.layerId]?.locked ? 'draggable' : ''}`}
              onDoubleClick={(e) => {
                if (activeTool !== 'select') return;
                if (obj.type !== 'text') return;
                e.stopPropagation();
                setTextInput({
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height,
                  text: obj.text || '',
                  fontSize: obj.fontSize || 16,
                  existingId: obj.id,
                });
              }}
              style={style}
            >
              {obj.type === 'text' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    fontSize: `${(obj.fontSize || 16) * zoom}px`,
                    fontFamily: obj.fontFamily || 'Helvetica, Arial, sans-serif',
                    fontWeight: obj.fontWeight || 'normal',
                    fontStyle: obj.fontStyle || 'normal',
                    color: obj.color || '#000',
                    textAlign: obj.alignment || 'left',
                    lineHeight: obj.lineHeight || 1.2,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: obj.autoHeight ? 'visible' : 'hidden',
                  }}
                >
                  {obj.text}
                </div>
              )}
              {obj.type === 'signature' && (
                <img src={obj.dataUrl} alt="Signature" draggable={false} />
              )}
              {['text', 'signature', 'image', 'highlight', 'redact', 'whiteout'].includes(obj.type) && !obj.locked && !layers?.[obj.layerId]?.locked && (
                <button
                  className="annotation-delete"
                  onClick={(e) => { e.stopPropagation(); onDeleteObject(obj.id); }}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          );
          })}
        </div>


        <div className={RENDER_LAYERS.overlay}>
          {activeTool === 'draw' && drawingPoints && drawingPoints.length > 1 && (
            <svg className="drawing-live" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <polyline
                points={drawingPoints.map(p => `${p.x * zoom},${(pdfPageHeight - p.y) * zoom}`).join(' ')}
                fill="none"
                stroke="#000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {activeTool === 'image' && imageRect && imagePlacement?.dataUrl && (
            <div
              className="image-overlay"
              style={{
                left: imageRect.x,
                top: imageRect.y,
                width: imageRect.width,
                height: imageRect.height,
              }}
            >
              <img src={imagePlacement.dataUrl} alt="Image preview" draggable={false} />
            </div>
          )}

          {activeTool === 'text' && textBoxRect && (
            <div
              className="text-box-overlay"
              style={{
                left: textBoxRect.x,
                top: textBoxRect.y,
                width: textBoxRect.width,
                height: textBoxRect.height,
              }}
            />
          )}

          {activeTool === 'highlight' && highlightRect && (
            <div
              className="highlight-overlay"
              style={{
                left: highlightRect.x,
                top: highlightRect.y,
                width: highlightRect.width,
                height: highlightRect.height,
              }}
            />
          )}

          {activeTool === 'redact' && redactRect && (
            <div
              className="redact-overlay"
              style={{
                left: redactRect.x,
                top: redactRect.y,
                width: redactRect.width,
                height: redactRect.height,
              }}
            />
          )}

          {activeTool === 'edit' && editRect && (
            <div
              className="edit-overlay"
              style={{
                left: editRect.x,
                top: editRect.y,
                width: editRect.width,
                height: editRect.height,
              }}
            />
          )}

          {editInput && (
            <div
              className="edit-input-overlay"
              style={{
                left: editInput.x,
                top: editInput.y,
                width: editInput.width,
                height: editInput.height,
              }}
            >
              <input
                type="text"
                autoFocus
                value={editInput.text}
                onChange={(e) => setEditInput({ ...editInput, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSubmit();
                  if (e.key === 'Escape') setEditInput(null);
                }}
                onBlur={handleEditSubmit}
                placeholder="Replacement text (optional)..."
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          )}

          {textInput && (
            <div
              className="text-input-overlay"
              style={{ left: textInput.x, top: textInput.y, width: textInput.width, height: textInput.height }}
            >
              <textarea
                ref={textAreaRef}
                autoFocus
                value={textInput.text}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setTextInput(null);
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleTextSubmit();
                }}
                onBlur={handleTextSubmit}
                placeholder="Type text..."
                style={{ width: '100%', height: '100%', resize: 'both' }}
              />
            </div>
          )}

          {activeTool === 'crop' && cropRect && (
            <>
              <div
                className="crop-overlay"
                style={{
                  left: cropRect.x,
                  top: cropRect.y,
                  width: cropRect.width,
                  height: cropRect.height,
                }}
              />
              <div
                className="crop-actions"
                style={{
                  left: cropRect.x,
                  top: cropRect.y + cropRect.height + 8,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button onClick={handleCropApply}>Apply Crop</button>
                <button onClick={() => { setCropRect(null); onCropCancel(); }}>Cancel</button>
              </div>
            </>
          )}

          {interactionState.lassoRect && (
            <div
              className="lasso-overlay"
              style={{
                left: interactionState.lassoRect.x,
                top: interactionState.lassoRect.y,
                width: interactionState.lassoRect.width,
                height: interactionState.lassoRect.height,
              }}
            />
          )}

          {snapGuides.map((g, i) => {
            if (g.kind === 'segment') {
              return (
                <div
                  key={`snap-seg-${i}`}
                  className="snap-guide snap-guide-segment"
                  style={{ left: g.left, top: g.top, width: g.width, height: g.height }}
                />
              );
            }
            return g.axis === 'x'
              ? <div key={`snap-x-${i}`} className="snap-guide snap-guide-x" style={{ left: g.left }} />
              : <div key={`snap-y-${i}`} className="snap-guide snap-guide-y" style={{ top: g.top }} />;
          })}

          {showCancelHint && (
            <div className="overlay-hint">Esc cancels</div>
          )}
        </div>

        <div className={RENDER_LAYERS.selection}>
          {selectionScreen && selectedObjects.length > 1 && (
            <div
              className="align-toolbar"
              style={{ left: selectionScreen.left, top: selectionScreen.top - 36 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button title="Align Left" onClick={() => applyAlignment('left')}>L</button>
              <button title="Align Center" onClick={() => applyAlignment('centerH')}>C</button>
              <button title="Align Right" onClick={() => applyAlignment('right')}>R</button>
              <div className="align-divider" />
              <button title="Align Top" onClick={() => applyAlignment('top')}>T</button>
              <button title="Align Middle" onClick={() => applyAlignment('centerV')}>M</button>
              <button title="Align Bottom" onClick={() => applyAlignment('bottom')}>B</button>
              <div className="align-divider" />
              <button title="Distribute Horizontally" onClick={() => applyAlignment('distributeH')}>H</button>
              <button title="Distribute Vertically" onClick={() => applyAlignment('distributeV')}>V</button>
            </div>
          )}

          {selectionScreen && (
            <>
              <div
                className="selection-box"
                style={{ left: selectionScreen.left, top: selectionScreen.top, width: selectionScreen.width, height: selectionScreen.height }}
              />
              {selectedObjects.length > 0 && selectedObjects.every(obj => !obj.locked && !layers?.[obj.layerId]?.locked) && (
                <>
                  <div
                    className="rotation-handle"
                    style={{
                      left: selectionScreen.left + selectionScreen.width / 2 - 5,
                      top: selectionScreen.top - 18,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const pos = getCanvasPos(e);
                      const pdfPos = screenToPdfPoint(pos.x, pos.y);
                      const nextState = startRotate(selectionBounds, selectedObjects, pdfPos);
                      setInteractionState(prev => ({ ...prev, ...nextState }));
                    }}
                  />
                  <div className="resize-handle handle-nw" style={{ left: selectionScreen.left - 4, top: selectionScreen.top - 4 }} onMouseDown={(e) => handleResizeStart(e, 'nw')} />
                  <div className="resize-handle handle-n" style={{ left: selectionScreen.left + selectionScreen.width / 2 - 4, top: selectionScreen.top - 4 }} onMouseDown={(e) => handleResizeStart(e, 'n')} />
                  <div className="resize-handle handle-ne" style={{ left: selectionScreen.left + selectionScreen.width - 4, top: selectionScreen.top - 4 }} onMouseDown={(e) => handleResizeStart(e, 'ne')} />
                  <div className="resize-handle handle-e" style={{ left: selectionScreen.left + selectionScreen.width - 4, top: selectionScreen.top + selectionScreen.height / 2 - 4 }} onMouseDown={(e) => handleResizeStart(e, 'e')} />
                  <div className="resize-handle handle-se" style={{ left: selectionScreen.left + selectionScreen.width - 4, top: selectionScreen.top + selectionScreen.height - 4 }} onMouseDown={(e) => handleResizeStart(e, 'se')} />
                  <div className="resize-handle handle-s" style={{ left: selectionScreen.left + selectionScreen.width / 2 - 4, top: selectionScreen.top + selectionScreen.height - 4 }} onMouseDown={(e) => handleResizeStart(e, 's')} />
                  <div className="resize-handle handle-sw" style={{ left: selectionScreen.left - 4, top: selectionScreen.top + selectionScreen.height - 4 }} onMouseDown={(e) => handleResizeStart(e, 'sw')} />
                  <div className="resize-handle handle-w" style={{ left: selectionScreen.left - 4, top: selectionScreen.top + selectionScreen.height / 2 - 4 }} onMouseDown={(e) => handleResizeStart(e, 'w')} />
                </>
              )}
            </>
          )}
        </div>

        {watermarkText && (
          <div className="watermark-overlay">
            <span>{watermarkText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

