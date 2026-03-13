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
      <div className="thumbnail-list">
        {Array.from({ length: numPages }, (_, i) => (
          <ThumbnailItem
            key={`page-${i}-${numPages}`}
            renderDoc={renderDoc}
            index={i}
            isActive={currentPage === i + 1}
            onSelect={() => onPageSelect(i + 1)}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => { e.preventDefault(); setDropIndex(i); }}
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
  const observerRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !renderDoc) return;
    if (rendered) return;

    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !rendered) {
        renderPageToCanvas(renderDoc, index + 1, canvasRef.current, 0.2).catch(() => {});
        setRendered(true);
        observerRef.current?.disconnect();
      }
    }, { rootMargin: '200px' });

    observerRef.current.observe(canvasRef.current);
    return () => observerRef.current?.disconnect();
  }, [renderDoc, index, rendered]);

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
      <canvas ref={canvasRef} />
      <span className="page-number">{index + 1}</span>
    </div>
  );
}
