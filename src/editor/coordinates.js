/**
 * Coordinate conversion utilities — MilPDF 2.0
 *
 * Screen space:  origin top-left, y increases downward, units = CSS pixels
 * PDF space:     origin bottom-left, y increases upward, units = PDF points
 *
 * zoom: the current display scale factor (1.0 = 100%)
 * pageHeight: the PDF page height in PDF points
 *
 * At zoom=1, 1 CSS pixel = 1 PDF point.
 * At zoom=2, 2 CSS pixels = 1 PDF point.
 */

/**
 * Convert a screen-space point to PDF-space.
 * @param {number} screenX  CSS pixels from left of canvas
 * @param {number} screenY  CSS pixels from top of canvas
 * @param {number} pageHeight  Page height in PDF points
 * @param {number} zoom
 * @returns {{ pdfX: number, pdfY: number }}
 */
export function screenToPdf(screenX, screenY, pageHeight, zoom) {
  const pdfX = screenX / zoom;
  const pdfY = pageHeight - screenY / zoom;
  return { pdfX, pdfY };
}

/**
 * Convert a PDF-space point to screen-space.
 * @param {number} pdfX
 * @param {number} pdfY
 * @param {number} pageHeight  Page height in PDF points
 * @param {number} zoom
 * @returns {{ screenX: number, screenY: number }}
 */
export function pdfToScreen(pdfX, pdfY, pageHeight, zoom) {
  const screenX = pdfX * zoom;
  const screenY = (pageHeight - pdfY) * zoom;
  return { screenX, screenY };
}

/**
 * Convert a PDF-space width/height to screen-space (no Y flip — scalar).
 */
export function pdfSizeToScreen(pdfWidth, pdfHeight, zoom) {
  return {
    screenWidth: pdfWidth * zoom,
    screenHeight: pdfHeight * zoom,
  };
}

/**
 * Convert a screen-space width/height to PDF-space.
 */
export function screenSizeToPdf(screenWidth, screenHeight, zoom) {
  return {
    pdfWidth: screenWidth / zoom,
    pdfHeight: screenHeight / zoom,
  };
}

/**
 * Given a PDF-space rect (pdfX, pdfY are bottom-left corner in PDF space),
 * return the top-left screen position and dimensions for CSS layout.
 *
 * Note: pdfY is the BOTTOM edge in PDF space. The screen TOP edge is:
 *   screenTop = (pageHeight - pdfY - height) * zoom
 */
export function pdfRectToScreen(pdfX, pdfY, pdfWidth, pdfHeight, pageHeight, zoom) {
  const screenLeft = pdfX * zoom;
  const screenTop = (pageHeight - pdfY - pdfHeight) * zoom;
  const screenWidth = pdfWidth * zoom;
  const screenHeight = pdfHeight * zoom;
  return { screenLeft, screenTop, screenWidth, screenHeight };
}

/**
 * Convert a screen-space rect (top-left origin) to a PDF-space rect (bottom-left origin).
 * screenY is the TOP of the rect in screen space.
 * Returns pdfY as the BOTTOM edge in PDF space.
 */
export function screenRectToPdf(screenX, screenY, screenWidth, screenHeight, pageHeight, zoom) {
  const pdfX = screenX / zoom;
  const pdfWidth = screenWidth / zoom;
  const pdfHeight = screenHeight / zoom;
  const pdfY = pageHeight - screenY / zoom - pdfHeight;
  return { pdfX, pdfY, pdfWidth, pdfHeight };
}
