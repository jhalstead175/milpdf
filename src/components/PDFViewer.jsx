import { useEffect, useRef, useState, useCallback } from 'react';
import { renderPageToCanvas } from '../utils/pdfUtils';

export default function PDFViewer({
  renderDoc, currentPage, zoom, activeTool,
  annotations, onAddAnnotation, onDeleteAnnotation, onUpdateAnnotation,
  signatureDataUrl, onRequestSignature,
  onCropApply, onCropCancel,
  onDropFile,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [textInput, setTextInput] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [cropStart, setCropStart] = useState(null);
  const [highlightRect, setHighlightRect] = useState(null);
  const [highlightStart, setHighlightStart] = useState(null);
  const [redactRect, setRedactRect] = useState(null);
  const [redactStart, setRedactStart] = useState(null);
  const [drawingPoints, setDrawingPoints] = useState(null);
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY }
  const [isDragOver, setIsDragOver] = useState(false);

  // Render the current page
  useEffect(() => {
    if (renderDoc && canvasRef.current) {
      renderPageToCanvas(renderDoc, currentPage, canvasRef.current, zoom)
        .catch(console.error);
    }
  }, [renderDoc, currentPage, zoom]);

  // Reset tool-specific state when tool changes
  useEffect(() => {
    if (activeTool !== 'crop') { setCropRect(null); setCropStart(null); }
    if (activeTool !== 'highlight') { setHighlightRect(null); setHighlightStart(null); }
    if (activeTool !== 'redact') { setRedactRect(null); setRedactStart(null); }
    if (activeTool !== 'draw') { setDrawingPoints(null); }
  }, [activeTool]);

  const pageAnnotations = annotations.filter(a => a.pageNum === currentPage);

  const getCanvasPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // --- Canvas click (text / signature placement) ---
  const handleCanvasClick = useCallback((e) => {
    if (!canvasRef.current) return;
    if (activeTool === 'highlight' || activeTool === 'redact' || activeTool === 'crop' || activeTool === 'draw') return;
    if (dragging) return;
    const { x, y } = getCanvasPos(e);

    if (activeTool === 'text') {
      setTextInput({ x, y, text: '' });
    } else if (activeTool === 'signature') {
      if (!signatureDataUrl) {
        onRequestSignature();
        return;
      }
      onAddAnnotation({
        id: Date.now(),
        type: 'signature',
        pageNum: currentPage,
        x, y,
        width: 200,
        height: 80,
        dataUrl: signatureDataUrl,
        scale: zoom,
      });
    }
  }, [activeTool, currentPage, signatureDataUrl, onRequestSignature, onAddAnnotation, zoom, getCanvasPos, dragging]);

  const handleTextSubmit = useCallback(() => {
    if (textInput && textInput.text.trim()) {
      onAddAnnotation({
        id: Date.now(),
        type: 'text',
        pageNum: currentPage,
        x: textInput.x,
        y: textInput.y,
        text: textInput.text,
        fontSize: 16,
        scale: zoom,
      });
    }
    setTextInput(null);
  }, [textInput, currentPage, onAddAnnotation, zoom]);

  // --- Mouse handlers: crop, highlight, draw, drag ---
  const handleMouseDown = useCallback((e) => {
    if (!canvasRef.current) return;
    const { x, y } = getCanvasPos(e);

    if (activeTool === 'crop') {
      setCropStart({ x, y }); setCropRect(null);
    } else if (activeTool === 'highlight') {
      setHighlightStart({ x, y }); setHighlightRect(null);
    } else if (activeTool === 'redact') {
      setRedactStart({ x, y }); setRedactRect(null);
    } else if (activeTool === 'draw') {
      setDrawingPoints([{ x, y }]);
    }
  }, [activeTool, getCanvasPos]);

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const { x, y } = getCanvasPos(e);

    if (activeTool === 'crop' && cropStart) {
      setCropRect({
        x: Math.min(cropStart.x, x), y: Math.min(cropStart.y, y),
        width: Math.abs(x - cropStart.x), height: Math.abs(y - cropStart.y),
      });
    } else if (activeTool === 'highlight' && highlightStart) {
      setHighlightRect({
        x: Math.min(highlightStart.x, x), y: Math.min(highlightStart.y, y),
        width: Math.abs(x - highlightStart.x), height: Math.abs(y - highlightStart.y),
      });
    } else if (activeTool === 'redact' && redactStart) {
      setRedactRect({
        x: Math.min(redactStart.x, x), y: Math.min(redactStart.y, y),
        width: Math.abs(x - redactStart.x), height: Math.abs(y - redactStart.y),
      });
    } else if (activeTool === 'draw' && drawingPoints) {
      setDrawingPoints(prev => [...prev, { x, y }]);
    } else if (dragging) {
      onUpdateAnnotation(dragging.id, {
        x: (x - dragging.offsetX),
        y: (y - dragging.offsetY),
        scale: zoom,
      });
    }
  }, [activeTool, cropStart, highlightStart, redactStart, drawingPoints, dragging, getCanvasPos, onUpdateAnnotation, zoom]);

  const handleMouseUp = useCallback(() => {
    setCropStart(null);

    // Finish highlight
    if (activeTool === 'highlight' && highlightRect && highlightRect.width > 5 && highlightRect.height > 5) {
      onAddAnnotation({
        id: Date.now(),
        type: 'highlight',
        pageNum: currentPage,
        x: highlightRect.x,
        y: highlightRect.y,
        width: highlightRect.width,
        height: highlightRect.height,
        scale: zoom,
      });
      setHighlightRect(null);
    }
    setHighlightStart(null);

    // Finish redaction
    if (activeTool === 'redact' && redactRect && redactRect.width > 5 && redactRect.height > 5) {
      onAddAnnotation({
        id: Date.now(),
        type: 'redact',
        pageNum: currentPage,
        x: redactRect.x,
        y: redactRect.y,
        width: redactRect.width,
        height: redactRect.height,
        scale: zoom,
      });
      setRedactRect(null);
    }
    setRedactStart(null);

    // Finish drawing
    if (activeTool === 'draw' && drawingPoints && drawingPoints.length > 2) {
      onAddAnnotation({
        id: Date.now(),
        type: 'drawing',
        pageNum: currentPage,
        points: drawingPoints,
        color: '#000000',
        lineWidth: 2,
        scale: zoom,
      });
    }
    setDrawingPoints(null);

    setDragging(null);
  }, [activeTool, highlightRect, redactRect, drawingPoints, currentPage, onAddAnnotation, zoom]);

  const handleCropApply = useCallback(() => {
    if (cropRect && cropRect.width > 10 && cropRect.height > 10) {
      onCropApply({ ...cropRect, scale: zoom });
      setCropRect(null);
    }
  }, [cropRect, onCropApply, zoom]);

  // --- Drag annotation to reposition ---
  const handleAnnotationMouseDown = useCallback((e, ann) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const annScreenX = ann.x * (zoom / ann.scale);
    const annScreenY = ann.y * (zoom / ann.scale);
    setDragging({
      id: ann.id,
      offsetX: mx - annScreenX,
      offsetY: my - annScreenY,
    });
  }, [activeTool, zoom]);

  // --- Drag-and-drop file ---
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      onDropFile(file);
    }
  }, [onDropFile]);

  // --- Empty state ---
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

        {/* Annotation overlays */}
        {pageAnnotations.map(ann => {
          const sx = zoom / ann.scale;
          if (ann.type === 'drawing') {
            return (
              <svg key={ann.id} className="annotation annotation-drawing" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <polyline
                  points={ann.points.map(p => `${p.x * sx},${p.y * sx}`).join(' ')}
                  fill="none"
                  stroke={ann.color || '#000'}
                  strokeWidth={ann.lineWidth || 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          }
          return (
            <div
              key={ann.id}
              className={`annotation annotation-${ann.type} ${activeTool === 'select' ? 'draggable' : ''}`}
              style={{
                left: ann.x * sx,
                top: ann.y * sx,
                ...(ann.type === 'signature' ? {
                  width: ann.width * sx,
                  height: ann.height * sx,
                } : {}),
                ...(ann.type === 'highlight' ? {
                  width: ann.width * sx,
                  height: ann.height * sx,
                } : {}),
                ...(ann.type === 'redact' ? {
                  width: ann.width * sx,
                  height: ann.height * sx,
                } : {}),
              }}
              onMouseDown={(e) => handleAnnotationMouseDown(e, ann)}
            >
              {ann.type === 'text' && (
                <span style={{ fontSize: `${(ann.fontSize || 16) * sx}px` }}>
                  {ann.text}
                </span>
              )}
              {ann.type === 'signature' && (
                <img src={ann.dataUrl} alt="Signature" draggable={false} />
              )}
              <button
                className="annotation-delete"
                onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(ann.id); }}
                title="Remove"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Live freehand drawing */}
        {activeTool === 'draw' && drawingPoints && drawingPoints.length > 1 && (
          <svg className="drawing-live" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <polyline
              points={drawingPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#000"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Live highlight preview */}
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

        {/* Live redaction preview */}
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

        {/* Inline text input */}
        {textInput && (
          <div className="text-input-overlay" style={{ left: textInput.x, top: textInput.y }}>
            <input
              type="text"
              autoFocus
              value={textInput.text}
              onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTextSubmit();
                if (e.key === 'Escape') setTextInput(null);
              }}
              onBlur={handleTextSubmit}
              placeholder="Type text..."
            />
          </div>
        )}

        {/* Crop rectangle overlay */}
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
      </div>
    </div>
  );
}
