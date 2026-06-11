import { useEffect, useState } from 'react';
import { RotateCcw, RotateCw, Trash2, X } from 'lucide-react';
import { renderPageToCanvas } from '../utils/pdfUtils';

function OrganizeThumb({ renderDoc, index }) {
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    if (!renderDoc) return undefined;
    let cancelled = false;
    const offscreen = document.createElement('canvas');
    const tryRender = (delay) => setTimeout(() => {
      if (cancelled) return;
      renderPageToCanvas(renderDoc, index + 1, offscreen, 0.4)
        .then(() => { if (!cancelled) setImgSrc(offscreen.toDataURL()); })
        .catch(() => { if (!cancelled) tryRender(1000); });
    }, delay);
    const t = tryRender(150 + index * 30);
    return () => { cancelled = true; clearTimeout(t); };
  }, [renderDoc, index]);

  return imgSrc
    ? <img src={imgSrc} alt={`Page ${index + 1}`} className="organize-thumb-img" />
    : <div className="organize-thumb-placeholder" />;
}

export default function OrganizePagesModal({
  renderDoc, numPages, currentPage,
  onReorder, onRotatePage, onDeletePage, onAppendBlank, onPageSelect, onClose,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal organize-modal" onClick={(e) => e.stopPropagation()}>
        <div className="organize-header">
          <div>
            <h3>Organize Pages</h3>
            <p className="modal-hint">Drag to reorder. Rotate or delete individual pages.</p>
          </div>
          <div className="organize-header-actions">
            <button className="btn-secondary" onClick={onAppendBlank}>Add blank page</button>
            <button className="organize-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="organize-grid" onDragOver={(e) => e.preventDefault()}>
          {Array.from({ length: numPages }, (_, i) => (
            <div
              key={`org-${i}-${numPages}`}
              className={`organize-card ${currentPage === i + 1 ? 'active' : ''} ${dropIndex === i && dragIndex !== i ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragIndex(i); }}
              onDragOver={(e) => { e.preventDefault(); setDropIndex(i); }}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
                setDragIndex(null); setDropIndex(null);
              }}
              onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
            >
              <div className="organize-thumb" onClick={() => onPageSelect(i + 1)} title={`Go to page ${i + 1}`}>
                <OrganizeThumb renderDoc={renderDoc} index={i} />
              </div>
              <div className="organize-card-bar">
                <span className="organize-page-num">{i + 1}</span>
                <div className="organize-card-actions">
                  <button title="Rotate left" aria-label="Rotate left" onClick={() => onRotatePage(i + 1, -90)}>
                    <RotateCcw size={14} />
                  </button>
                  <button title="Rotate right" aria-label="Rotate right" onClick={() => onRotatePage(i + 1, 90)}>
                    <RotateCw size={14} />
                  </button>
                  <button
                    className="organize-delete"
                    title="Delete page"
                    aria-label="Delete page"
                    disabled={numPages <= 1}
                    onClick={() => onDeletePage(i + 1)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
