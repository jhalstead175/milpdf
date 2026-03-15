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

    const offscreen = document.createElement('canvas');

    const tryRender = (delay) => {
      const timer = setTimeout(() => {
        if (cancelled) return;
        renderPageToCanvas(renderDoc, index + 1, offscreen, 0.25)
          .then(() => {
            if (!cancelled) setImgSrc(offscreen.toDataURL());
          })
          .catch(() => {
            // PDF.js serialises renders per-page: if the main viewer is rendering
            // the same page concurrently, we lose the race. Retry once after 1 s.
            if (!cancelled) tryRender(1000);
          });
      }, delay);
      return timer;
    };

    // Small initial delay so the main viewer's first render wins the PDF.js lock
    // on page 1 (and whichever page is current). Stagger by index to spread load.
    const t = tryRender(200 + index * 40);
    return () => { cancelled = true; clearTimeout(t); };
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
