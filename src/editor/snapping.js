const SNAP_PX = 6;

export function snapPosition(candidatePdfX, candidatePdfY, candidateW, candidateH, otherObjects, zoom = 1) {
  let snapX = candidatePdfX;
  let snapY = candidatePdfY;
  let bestDX = null;
  let bestDY = null;
  let guideX = null;
  let guideY = null;
  const threshold = SNAP_PX / Math.max(zoom, 0.01);

  for (const obj of otherObjects) {
    const edges = {
      left: obj.pdfX,
      right: obj.pdfX + obj.width,
      top: obj.pdfY + obj.height,
      bottom: obj.pdfY,
      midX: obj.pdfX + obj.width / 2,
      midY: obj.pdfY + obj.height / 2,
    };
    const candidateEdges = {
      left: candidatePdfX,
      right: candidatePdfX + candidateW,
      midX: candidatePdfX + candidateW / 2,
      bottom: candidatePdfY,
      top: candidatePdfY + candidateH,
      midY: candidatePdfY + candidateH / 2,
    };

    const xPairs = [
      ['left', 'left'], ['left', 'right'], ['right', 'left'],
      ['right', 'right'], ['midX', 'midX'],
    ];
    for (const [ce, oe] of xPairs) {
      const delta = candidateEdges[ce] - edges[oe];
      if (Math.abs(delta) < threshold && (bestDX === null || Math.abs(delta) < Math.abs(bestDX))) {
        bestDX = delta;
        guideX = edges[oe];
      }
    }

    const yPairs = [
      ['bottom', 'bottom'], ['bottom', 'top'], ['top', 'bottom'],
      ['top', 'top'], ['midY', 'midY'],
    ];
    for (const [ce, oe] of yPairs) {
      const delta = candidateEdges[ce] - edges[oe];
      if (Math.abs(delta) < threshold && (bestDY === null || Math.abs(delta) < Math.abs(bestDY))) {
        bestDY = delta;
        guideY = edges[oe];
      }
    }
  }

  if (bestDX !== null) snapX = candidatePdfX - bestDX;
  if (bestDY !== null) snapY = candidatePdfY - bestDY;

  const guides = [];
  if (guideX !== null) guides.push({ axis: 'x', pdfX: guideX });
  if (guideY !== null) guides.push({ axis: 'y', pdfY: guideY });

  return { snapX, snapY, guides };
}

export function snapGuidesToScreen(guides, zoom, pageHeight) {
  return guides.map(g => (
    g.axis === 'x'
      ? { axis: 'x', left: g.pdfX * zoom }
      : { axis: 'y', top: (pageHeight - g.pdfY) * zoom }
  ));
}