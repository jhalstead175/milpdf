import { useEffect, useState } from 'react';

/**
 * Extracts text blocks from a PDF page using PDF.js getTextContent().
 * Returns screen-space bounding boxes when the edit tool is active.
 *
 * Text items are grouped into lines (same Y), then lines into paragraphs
 * (vertically adjacent within ~2× line height), so each detected block
 * corresponds to a paragraph or isolated line the user can click to edit.
 */
export function useContentBlocks(renderDoc, currentPage, zoom, enabled) {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (!enabled || !renderDoc || !currentPage) {
      setBlocks([]);
      return;
    }

    let cancelled = false;

    renderDoc.getPage(currentPage).then(async page => {
      const viewport = page.getViewport({ scale: 1 });
      const pageHeight = viewport.height; // PDF-space height

      const content = await page.getTextContent();
      if (cancelled) return;

      // Map each PDF.js item to a simple record in PDF space
      const items = content.items
        .filter(item => item.str && item.str.trim())
        .map(item => {
          const [a, , , d, x, y] = item.transform;
          const fontSize = Math.abs(a) || Math.abs(d) || 10;
          const width = item.width || 0;
          const height = Math.abs(d) || fontSize;
          return { str: item.str, x, y, width, height, fontSize };
        })
        .filter(item => item.width > 0); // skip zero-width items

      if (!items.length) { setBlocks([]); return; }

      // ── Step 1: Group items into lines by Y proximity ──────────────────
      const lines = [];
      for (const item of items) {
        const tol = item.fontSize * 0.4;
        const existing = lines.find(l => Math.abs(l.baseY - item.y) <= tol);
        if (existing) {
          existing.items.push(item);
          existing.minX    = Math.min(existing.minX, item.x);
          existing.maxX    = Math.max(existing.maxX, item.x + item.width);
          existing.maxH    = Math.max(existing.maxH, item.height);
          existing.baseY   = (existing.baseY + item.y) / 2; // running average
          existing.fontSize = Math.max(existing.fontSize, item.fontSize);
        } else {
          lines.push({
            baseY: item.y,
            minX: item.x,
            maxX: item.x + item.width,
            maxH: item.height,
            fontSize: item.fontSize,
            items: [item],
          });
        }
      }

      // Sort lines top-to-bottom in PDF space (descending Y)
      lines.sort((a, b) => b.baseY - a.baseY);

      // ── Step 2: Group lines into paragraph blocks ──────────────────────
      const paragraphs = [];
      for (const line of lines) {
        const last = paragraphs[paragraphs.length - 1];
        const gap = last ? last.minY - (line.baseY + line.maxH) : Infinity;

        if (last && gap < line.fontSize * 2.0) {
          // Same paragraph — extend bounds
          last.minY  = Math.min(last.minY, line.baseY);
          last.maxY  = Math.max(last.maxY, line.baseY + line.maxH);
          last.minX  = Math.min(last.minX, line.minX);
          last.maxX  = Math.max(last.maxX, line.maxX);
          last.text += '\n' + line.items.map(i => i.str).join('');
          last.fontSize = Math.max(last.fontSize, line.fontSize);
        } else {
          paragraphs.push({
            minX:     line.minX,
            maxX:     line.maxX,
            minY:     line.baseY,
            maxY:     line.baseY + line.maxH,
            fontSize: line.fontSize,
            text:     line.items.map(i => i.str).join(''),
          });
        }
      }

      // ── Step 3: Convert PDF space → screen space ───────────────────────
      const PADDING = 2; // px padding around each block handle
      const screenBlocks = paragraphs
        .filter(b => (b.maxX - b.minX) > 4 && (b.maxY - b.minY) > 2)
        .map(b => ({
          x:        b.minX * zoom - PADDING,
          y:        (pageHeight - b.maxY) * zoom - PADDING,
          width:    (b.maxX - b.minX) * zoom + PADDING * 2,
          height:   (b.maxY - b.minY) * zoom + PADDING * 2,
          text:     b.text,
          fontSize: b.fontSize,
          type:     'text',
        }));

      if (!cancelled) setBlocks(screenBlocks);
    }).catch(() => {
      if (!cancelled) setBlocks([]);
    });

    return () => { cancelled = true; };
  }, [renderDoc, currentPage, zoom, enabled]);

  return blocks;
}
