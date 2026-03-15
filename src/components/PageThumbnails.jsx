import { useEffect, useState } from 'react';
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
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    if (!renderDoc) return;
    let cancelled = false;

    // Render to an offscreen canvas, then snapshot to a data URL.
    // This avoids all CSS conflicts with in-DOM canvas elements.
    const offscreen = document.createElement('canvas');
    renderPageToCanvas(renderDoc, index + 1, offscreen, 0.25)
      .then(() => {
        if (!cancelled) setImgSrc(offscreen.toDataURL());
      })
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
      {imgSrc
        ? <img src={imgSrc} alt={`Page ${index + 1}`} className="thumbnail-img" />
        : <div className="thumbnail-placeholder" />
      }
      <span className="page-number">{index + 1}</span>
    </div>
  );
}
