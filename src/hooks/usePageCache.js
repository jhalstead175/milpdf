import { useCallback, useEffect, useRef } from 'react';
import { renderPageToCanvas } from '../utils/pdfUtils';

export default function usePageCache(renderDoc, zoom) {
  const cacheRef = useRef(new Map());

  const getPage = useCallback(async (pageNum) => {
    if (!renderDoc) return null;
    const key = `${pageNum}-${zoom.toFixed(2)}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    const offscreen = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1, 1)
      : document.createElement('canvas');

    const dims = await renderPageToCanvas(renderDoc, pageNum, offscreen, zoom);
    const bitmap = await createImageBitmap(offscreen);
    const entry = { bitmap, ...dims };
    cacheRef.current.set(key, entry);
    return entry;
  }, [renderDoc, zoom]);

  useEffect(() => {
    cacheRef.current.clear();
  }, [renderDoc, zoom]);

  return { getPage };
}