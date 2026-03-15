import { useEffect, useRef, useState } from 'react';
import { renderPageToCanvas } from '../utils/pdfUtils';

export default function PageThumbnails({
  renderDoc, numPages, currentPage, onPageSelect, onReorder,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  if (!renderDoc || numPages === 0) return null;

  return (
    <div className="page-thumbnails">
      <h3>Pages</h3>
      <div
        className="thumbnail-list"
        onDragOver={(e) => e.preventDefault()}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <ThumbnailItem
            key={`page-${i}-${numPages}`}
            renderDoc={renderDoc}
            index={i}
            isActive={currentPage === i + 1}
            onSelect={() => onPageSelect(i + 1)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(i));
              setDragIndex(i);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropIndex(i);
            }}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== i) {
                onReorder(dragIndex, i);
              }
              setDragIndex(null);
              setDropIndex(null);
            }}
            onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
            isDragOver={dropIndex === i && dragIndex !== i}
          />
        ))}
      </div>
    </div>
  );
}

function ThumbnailItem({
  renderDoc, index, isActive, onSelect,
  onDragStart, onDragOver, onDrop, onDragEnd, isDragOver,
}) {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !renderDoc) return;
    let cancelled = false;
    renderPageToCanvas(renderDoc, index + 1, canvasRef.current, 0.25)
      .then(() => { if (!cancelled) setRendered(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [renderDoc, index]);

  return (
    <div
      className={`thumbnail-item ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {!rendered && <div className="thumbnail-placeholder" />}
      <canvas ref={canvasRef} style={{ display: rendered ? 'block' : 'none' }} />
      <span className="page-number">{index + 1}</span>
    </div>
  );
}
