import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { renderPageToCanvas } from '../utils/pdfUtils';
import PDFViewer from './PDFViewer';

/**
 * Renders a static canvas for non-active pages.
 */
function StaticPageCanvas({ renderDoc, pageNum, zoom }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !renderDoc) return;
    renderPageToCanvas(renderDoc, pageNum, canvasRef.current, zoom).catch(() => {});
  }, [renderDoc, pageNum, zoom]);

  return (
    <div className="canvas-container">
      <canvas ref={canvasRef} />
    </div>
  );
}

/**
 * MultiPageScroller — renders all pages in a vertical scroll container.
 *
 * Active page renders the full PDFViewer (with tool overlays).
 * Other pages render a lightweight static canvas.
 *
 * Exposes scrollToPage(n) via ref for programmatic navigation.
 */
const MultiPageScroller = forwardRef(function MultiPageScroller({
  renderDoc,
  numPages,
  currentPage,
  zoom,
  onCurrentPageChange,
  ...pdfViewerProps
}, ref) {
  const scrollRef = useRef(null);
  const pageRefs = useRef([]);
  // Prevents IO feedback when we programmatically scroll to a page
  const ioTriggeredRef = useRef(false);

  // Scroll to page when currentPage changes (e.g. thumbnail click, arrow key)
  // Skip if the change was triggered by IntersectionObserver (already scrolled)
  useEffect(() => {
    if (ioTriggeredRef.current) return;
    const el = pageRefs.current[currentPage - 1];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentPage]);

  // IntersectionObserver: update currentPage as user scrolls
  useEffect(() => {
    if (!scrollRef.current || !renderDoc) return;
    const ratios = new Map();

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const page = parseInt(entry.target.dataset.page, 10);
        ratios.set(page, entry.intersectionRatio);
      }
      let maxPage = -1, maxRatio = -1;
      for (const [page, ratio] of ratios) {
        if (ratio > maxRatio) { maxRatio = ratio; maxPage = page; }
      }
      if (maxPage > 0) {
        ioTriggeredRef.current = true;
        onCurrentPageChange(maxPage);
        // Reset after React has had a chance to re-render
        setTimeout(() => { ioTriggeredRef.current = false; }, 150);
      }
    }, {
      root: scrollRef.current,
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
    });

    const els = pageRefs.current.slice(0, numPages).filter(Boolean);
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [renderDoc, numPages, onCurrentPageChange]);

  useImperativeHandle(ref, () => ({
    scrollToPage: (pageNum) => {
      const el = pageRefs.current[pageNum - 1];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }));

  // No doc: show the empty/drop state from PDFViewer
  if (!renderDoc) {
    return (
      <PDFViewer
        renderDoc={null}
        currentPage={1}
        zoom={zoom}
        {...pdfViewerProps}
      />
    );
  }

  return (
    <div ref={scrollRef} className="multi-page-scroller">
      {Array.from({ length: numPages }, (_, i) => {
        const pageNum = i + 1;
        const isActive = pageNum === currentPage;
        return (
          <div
            key={`page-${pageNum}`}
            ref={el => { pageRefs.current[i] = el; }}
            data-page={pageNum}
            className="page-section"
          >
            {isActive ? (
              <PDFViewer
                {...pdfViewerProps}
                renderDoc={renderDoc}
                currentPage={pageNum}
                zoom={zoom}
              />
            ) : (
              <StaticPageCanvas renderDoc={renderDoc} pageNum={pageNum} zoom={zoom} />
            )}
          </div>
        );
      })}
    </div>
  );
});

export default MultiPageScroller;
