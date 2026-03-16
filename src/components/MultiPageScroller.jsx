import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { renderPageToCanvas } from '../utils/pdfUtils';
import PDFViewer from './PDFViewer';

/**
 * Renders a static canvas for non-active pages.
 *
 * Lazy: defers the PDF.js render until the section is near the viewport.
 * This prevents all N pages from rendering simultaneously (which overwhelms
 * PDF.js and causes the main viewer + thumbnails to fail with getContext errors).
 */
function StaticPageCanvas({ renderDoc, pageNum, zoom }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Only start rendering when the page section scrolls near the viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: '300px' }   // pre-load 300px before entering view
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderDoc || !visible) return;
    let cancelled = false;
    // Capture canvas before async so it stays valid if we unmount mid-render.
    renderPageToCanvas(renderDoc, pageNum, canvas, zoom).catch(() => {});
    return () => { cancelled = true; void cancelled; };
  }, [renderDoc, pageNum, zoom, visible]);

  return (
    <div className="canvas-container" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}

/**
 * MultiPageScroller — renders all pages in a vertical scroll container.
 *
 * Active page renders the full PDFViewer (with tool overlays).
 * Other pages render a lightweight lazy static canvas.
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
  const scrollRef           = useRef(null);
  const pageRefs            = useRef([]);
  // Set to true while a programmatic scrollIntoView is in flight so the
  // IntersectionObserver does not fight us and flip currentPage back.
  const programmaticRef     = useRef(false);
  // Set to true when IO itself triggered the page change, so the scroll
  // effect below knows NOT to call scrollIntoView again.
  const ioTriggeredRef      = useRef(false);

  // Scroll to page when currentPage changes externally (thumbnail click, arrow key, etc.)
  useEffect(() => {
    if (ioTriggeredRef.current) return;   // IO already scrolled for us
    const el = pageRefs.current[currentPage - 1];
    if (!el) return;
    programmaticRef.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Keep the guard up long enough for the smooth scroll to land (~700 ms is
    // typical; we use 900 ms to be safe on slow machines).
    setTimeout(() => { programmaticRef.current = false; }, 900);
  }, [currentPage]);

  // IntersectionObserver: update currentPage as the user scrolls manually.
  useEffect(() => {
    if (!scrollRef.current || !renderDoc) return;
    const ratios = new Map();

    const observer = new IntersectionObserver((entries) => {
      // Ignore IO events caused by our own programmatic scrolling.
      if (programmaticRef.current) return;

      for (const entry of entries) {
        const page = parseInt(entry.target.dataset.page, 10);
        ratios.set(page, entry.intersectionRatio);
      }

      // Pick the page with the most visible area.
      let maxPage = -1, maxRatio = -1;
      for (const [page, ratio] of ratios) {
        if (ratio > maxRatio) { maxRatio = ratio; maxPage = page; }
      }

      // Only commit when at least 10 % of a page is visible.
      if (maxPage > 0 && maxRatio >= 0.1) {
        ioTriggeredRef.current = true;
        onCurrentPageChange(maxPage);
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
