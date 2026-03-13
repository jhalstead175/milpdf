import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FileSearch } from 'lucide-react';
import usePageCache from '../hooks/usePageCache';
import { makeId } from '../utils/id';
import { identityTransform, transformToCSS, transformedBounds } from '../editor/Transform';
import { snapPosition, snapGuidesToScreen } from '../editor/snapping';
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
  objects = [], layers = {},
  selectionIds = [],
  onSelectionChange,
  onAddObject, onDeleteObject, onUpdateObject, onBatchUpdateObjects,
  signatureDataUrl, onRequestSignature,
  onCropApply, onCropCancel,
  onDropFile, watermarkText,
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
  const [dragState, setDragState] = useState(null);
  const [selection, setSelection] = useState(() => new Set(selectionIds));
  const [lasso, setLasso] = useState(null);
  const [snapGuides, setSnapGuides] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editRect, setEditRect] = useState(null);
  const [editStart, setEditStart] = useState(null);
  const [editInput, setEditInput] = useState(null);
  const [nativeAnnotations, setNativeAnnotations] = useState([]);
  const [rotationState, setRotationState] = useState(null);
  const visibleObjects = useMemo(() => (
    objects
      .filter(o => o.page === currentPage)
      .filter(o => o.visible !== false)
      .filter(o => layers?.[o.layerId]?.visible !== false)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  ), [objects, currentPage, layers]);

  const pdfPageHeight = pageSize.height ? pageSize.height / zoom : 0;

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
    if (activeTool !== 'edit') { setEditRect(null); setEditStart(null); setEditInput(null); }
    if (activeTool !== 'text') { setTextBoxRect(null); setTextBoxStart(null); setTextInput(null); }
  }, [activeTool]);
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
    layerId,
    ...extra,
  }), [currentPage, getNextZIndex]);

  const selectedObjects = useMemo(
    () => visibleObjects.filter(o => selection.has(o.id)),
    [visibleObjects, selection]
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
    const sorted = [...visibleObjects].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
    for (const obj of sorted) {
      if (obj.locked) continue;
      if (layers?.[obj.layerId]?.locked) continue;
      const bounds = transformedBounds(obj);
      const screen = pdfRectToScreen(bounds.pdfX, bounds.pdfY, bounds.width, bounds.height);
      if (
        pos.x >= screen.left &&
        pos.x <= screen.left + screen.width &&
        pos.y >= screen.top &&
        pos.y <= screen.top + screen.height
      ) {
        return obj;
      }
    }
    return null;
  }, [visibleObjects, layers, pdfRectToScreen]);

  const handleCanvasClick = useCallback((e) => {
    if (!canvasRef.current) return;
    if (activeTool !== 'signature') return;
    if (!signatureDataUrl) {
      onRequestSignature();
      return;
    }
    const { x, y } = getCanvasPos(e);
    const rect = screenRectToPdf(x, y, 200, 80);
    onAddObject(createBaseObject('signature', rect, 'annotations', { dataUrl: signatureDataUrl }));
  }, [activeTool, signatureDataUrl, onRequestSignature, getCanvasPos, screenRectToPdf, createBaseObject, onAddObject]);

  const handleTextSubmit = useCallback(() => {
    if (textInput && textInput.text.trim()) {
      const width = textAreaRef.current?.offsetWidth ?? textInput.width;
      const height = textAreaRef.current?.offsetHeight ?? textInput.height;
      const rect = screenRectToPdf(textInput.x, textInput.y, width, height);
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
    setTextInput(null);
  }, [textInput, screenRectToPdf, onAddObject, createBaseObject]);

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
  const handleMouseDown = useCallback((e) => {
    if (!canvasRef.current) return;
    const pos = getCanvasPos(e);

    if (activeTool === 'select') {
      const obj = findObjectAt(pos);
      if (obj) {
        if (e.shiftKey) {
          const next = new Set(selection);
          next.has(obj.id) ? next.delete(obj.id) : next.add(obj.id);
          setSelection(next);
          if (onSelectionChange) onSelectionChange([...next]);
          return;
        }

        const next = selection.has(obj.id) ? selection : new Set([obj.id]);
        setSelection(next);
        if (onSelectionChange) onSelectionChange([...next]);
        const origPositions = {};
        for (const id of next) {
          const o = visibleObjects.find(item => item.id === id);
          if (o) origPositions[id] = { pdfX: o.pdfX, pdfY: o.pdfY, width: o.width, height: o.height };
        }
        setDragState({ ids: [...next], startPos: pos, origPositions });
      } else {
        if (!e.shiftKey) {
          setSelection(new Set());
          if (onSelectionChange) onSelectionChange([]);
        }
        setLasso({ startX: pos.x, startY: pos.y, x: pos.x, y: pos.y, width: 0, height: 0 });
      }
      return;
    }

    if (activeTool === 'text') {
      setTextBoxStart({ x: pos.x, y: pos.y });
      setTextBoxRect(null);
      return;
    }

    if (activeTool === 'crop') {
      setCropStart({ x: pos.x, y: pos.y }); setCropRect(null);
    } else if (activeTool === 'highlight') {
      setHighlightStart({ x: pos.x, y: pos.y }); setHighlightRect(null);
    } else if (activeTool === 'redact') {
      setRedactStart({ x: pos.x, y: pos.y }); setRedactRect(null);
    } else if (activeTool === 'draw') {
      setDrawingPoints([screenToPdfPoint(pos.x, pos.y)]);
    } else if (activeTool === 'edit') {
      setEditStart({ x: pos.x, y: pos.y }); setEditRect(null);
    }
  }, [activeTool, getCanvasPos, findObjectAt, selection, visibleObjects, screenToPdfPoint, onSelectionChange]);

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const pos = getCanvasPos(e);

    if (rotationState) {
      const { id, centerX, centerY, startAngle, origRotation } = rotationState;
      const angle = Math.atan2(pos.y - centerY, pos.x - centerX);
      const delta = ((angle - startAngle) * 180) / Math.PI;
      let newRot = origRotation - delta;
      if (e.shiftKey) newRot = Math.round(newRot / 15) * 15;
      const obj = objects.find(o => o.id === id);
      if (obj) {
        onUpdateObject(id, { transform: { ...(obj.transform ?? identityTransform()), rotation: newRot } });
      }
      return;
    }

    if (dragState) {
      const dx = (pos.x - dragState.startPos.x) / zoom;
      const dy = (pos.y - dragState.startPos.y) / zoom;
      const primaryId = dragState.ids[0];
      const primary = dragState.origPositions[primaryId];
      if (!primary) return;

      const otherObjects = visibleObjects.filter(o => !dragState.ids.includes(o.id));
      const candidateX = primary.pdfX + dx;
      const candidateY = primary.pdfY - dy;
      const snap = snapPosition(candidateX, candidateY, primary.width, primary.height, otherObjects);
      const snappedDx = snap.snapX - primary.pdfX;
      const snappedDy = snap.snapY - primary.pdfY;
      setSnapGuides(snapGuidesToScreen(snap.guides, zoom, pdfPageHeight));

      for (const id of dragState.ids) {
        const orig = dragState.origPositions[id];
        if (!orig) continue;
        onUpdateObject(id, {
          pdfX: orig.pdfX + snappedDx,
          pdfY: orig.pdfY + snappedDy,
        });
      }
      return;
    }

    if (lasso) {
      setLasso({
        startX: lasso.startX,
        startY: lasso.startY,
        x: Math.min(lasso.startX, pos.x),
        y: Math.min(lasso.startY, pos.y),
        width: Math.abs(pos.x - lasso.startX),
        height: Math.abs(pos.y - lasso.startY),
      });
      return;
    }

    if (activeTool === 'text' && textBoxStart) {
      setTextBoxRect({
        x: Math.min(textBoxStart.x, pos.x),
        y: Math.min(textBoxStart.y, pos.y),
        width: Math.abs(pos.x - textBoxStart.x),
        height: Math.abs(pos.y - textBoxStart.y),
      });
    } else if (activeTool === 'crop' && cropStart) {
      setCropRect({
        x: Math.min(cropStart.x, pos.x), y: Math.min(cropStart.y, pos.y),
        width: Math.abs(pos.x - cropStart.x), height: Math.abs(pos.y - cropStart.y),
      });
    } else if (activeTool === 'highlight' && highlightStart) {
      setHighlightRect({
        x: Math.min(highlightStart.x, pos.x), y: Math.min(highlightStart.y, pos.y),
        width: Math.abs(pos.x - highlightStart.x), height: Math.abs(pos.y - highlightStart.y),
      });
    } else if (activeTool === 'redact' && redactStart) {
      setRedactRect({
        x: Math.min(redactStart.x, pos.x), y: Math.min(redactStart.y, pos.y),
        width: Math.abs(pos.x - redactStart.x), height: Math.abs(pos.y - redactStart.y),
      });
    } else if (activeTool === 'draw' && drawingPoints) {
      setDrawingPoints(prev => [...prev, screenToPdfPoint(pos.x, pos.y)]);
    } else if (activeTool === 'edit' && editStart) {
      setEditRect({
        x: Math.min(editStart.x, pos.x), y: Math.min(editStart.y, pos.y),
        width: Math.abs(pos.x - editStart.x), height: Math.abs(pos.y - editStart.y),
      });
    }
  }, [getCanvasPos, rotationState, dragState, lasso, activeTool, textBoxStart, cropStart,
    highlightStart, redactStart, drawingPoints, editStart, zoom, pdfPageHeight, visibleObjects,
    onUpdateObject, objects, screenToPdfPoint]);
  const handleMouseUp = useCallback(() => {
    if (dragState) {
      setDragState(null);
      setSnapGuides([]);
    }

    if (lasso && lasso.width > 4 && lasso.height > 4) {
      const rect = screenRectToPdf(lasso.x, lasso.y, lasso.width, lasso.height);
      const hits = visibleObjects.filter(obj => {
        if (obj.locked) return false;
        if (layers?.[obj.layerId]?.locked) return false;
        const bounds = transformedBounds(obj);
        return (
          bounds.pdfX < rect.pdfX + rect.width &&
          bounds.pdfX + bounds.width > rect.pdfX &&
          bounds.pdfY < rect.pdfY + rect.height &&
          bounds.pdfY + bounds.height > rect.pdfY
        );
      });
      const next = new Set(hits.map(o => o.id));
      setSelection(next);
      if (onSelectionChange) onSelectionChange([...next]);
    }
    setLasso(null);

    if (activeTool === 'text' && textBoxRect && textBoxRect.width > 5 && textBoxRect.height > 5) {
      setTextInput({
        x: textBoxRect.x,
        y: textBoxRect.y,
        width: textBoxRect.width,
        height: textBoxRect.height,
        text: '',
        fontSize: 16,
      });
      setTextBoxRect(null);
    }
    setTextBoxStart(null);

    if (activeTool === 'highlight' && highlightRect && highlightRect.width > 5 && highlightRect.height > 5) {
      const rect = screenRectToPdf(highlightRect.x, highlightRect.y, highlightRect.width, highlightRect.height);
      onAddObject(createBaseObject('highlight', rect, 'annotations'));
      setHighlightRect(null);
    }
    setHighlightStart(null);

    if (activeTool === 'redact' && redactRect && redactRect.width > 5 && redactRect.height > 5) {
      const rect = screenRectToPdf(redactRect.x, redactRect.y, redactRect.width, redactRect.height);
      onAddObject(createBaseObject('redact', rect, 'annotations'));
      setRedactRect(null);
    }
    setRedactStart(null);

    if (activeTool === 'draw' && drawingPoints && drawingPoints.length > 2) {
      const xs = drawingPoints.map(p => p.x);
      const ys = drawingPoints.map(p => p.y);
      const rect = {
        pdfX: Math.min(...xs),
        pdfY: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
      onAddObject(createBaseObject('drawing', rect, 'annotations', {
        pdfPoints: drawingPoints,
        color: '#000000',
        lineWidth: 2,
      }));
    }
    setDrawingPoints(null);

    if (activeTool === 'edit' && editRect && editRect.width > 5 && editRect.height > 5) {
      setEditInput({ x: editRect.x, y: editRect.y, width: editRect.width, height: editRect.height, text: '' });
      setEditRect(null);
    }
    setEditStart(null);

    setRotationState(null);
  }, [dragState, lasso, screenRectToPdf, visibleObjects, layers, activeTool, textBoxRect,
    highlightRect, redactRect, drawingPoints, editRect, onAddObject, createBaseObject, onSelectionChange]);

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


  const selectionScreen = selectionBounds
    ? pdfRectToScreen(selectionBounds.pdfX, selectionBounds.pdfY, selectionBounds.width, selectionBounds.height)
    : null;

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

        {visibleObjects.map(obj => {
          const rect = pdfRectToScreen(obj.pdfX, obj.pdfY, obj.width, obj.height);
          const style = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            transformOrigin: 'center center',
            transform: obj.transform ? transformToCSS(obj.transform) : undefined,
          };

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

          return (
            <div
              key={obj.id}
              className={`annotation annotation-${obj.type} ${activeTool === 'select' ? 'draggable' : ''}`}

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
              {['text', 'signature', 'highlight', 'redact', 'whiteout'].includes(obj.type) && (
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
            >
              <button onClick={handleCropApply}>Apply Crop</button>
              <button onClick={() => { setCropRect(null); onCropCancel(); }}>Cancel</button>
            </div>
          </>
        )}

        {lasso && (
          <div
            className="lasso-overlay"
            style={{ left: lasso.x, top: lasso.y, width: lasso.width, height: lasso.height }}
          />
        )}

        {snapGuides.map((g, i) => (
          g.axis === 'x'
            ? <div key={`snap-x-${i}`} className="snap-guide snap-guide-x" style={{ left: g.left }} />
            : <div key={`snap-y-${i}`} className="snap-guide snap-guide-y" style={{ top: g.top }} />
        ))}

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
            {selectedObjects.length === 1 && (
              <div
                className="rotation-handle"
                style={{
                  left: selectionScreen.left + selectionScreen.width / 2 - 5,
                  top: selectionScreen.top - 18,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const pos = getCanvasPos(e);
                  const cx = selectionScreen.left + selectionScreen.width / 2;
                  const cy = selectionScreen.top + selectionScreen.height / 2;
                  const obj = selectedObjects[0];
                  setRotationState({
                    id: obj.id,
                    centerX: cx,
                    centerY: cy,
                    startAngle: Math.atan2(pos.y - cy, pos.x - cx),
                    origRotation: obj.transform?.rotation ?? 0,
                  });
                }}
              />
            )}
          </>
        )}

        {watermarkText && (
          <div className="watermark-overlay">
            <span>{watermarkText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

