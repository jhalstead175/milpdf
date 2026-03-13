const SNAP_THRESHOLD_PDF = 4;

export function snapPosition(candidatePdfX, candidatePdfY, candidateW, candidateH, otherObjects) {
  let snapX = candidatePdfX;
  let snapY = candidatePdfY;
  const guides = [];

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
      if (Math.abs(candidateEdges[ce] - edges[oe]) < SNAP_THRESHOLD_PDF) {
        snapX = edges[oe] - (candidateEdges[ce] - candidatePdfX);
        guides.push({ axis: 'x', pdfX: edges[oe] });
      }
    }

    const yPairs = [
      ['bottom', 'bottom'], ['bottom', 'top'], ['top', 'bottom'],
      ['top', 'top'], ['midY', 'midY'],
    ];
    for (const [ce, oe] of yPairs) {
      if (Math.abs(candidateEdges[ce] - edges[oe]) < SNAP_THRESHOLD_PDF) {
        snapY = edges[oe] - (candidateEdges[ce] - candidatePdfY);
        guides.push({ axis: 'y', pdfY: edges[oe] });
      }
    }
  }

  return { snapX, snapY, guides };
}

export function snapGuidesToScreen(guides, zoom, pageHeight) {
  return guides.map(g => (
    g.axis === 'x'
      ? { axis: 'x', left: g.pdfX * zoom }
      : { axis: 'y', top: (pageHeight - g.pdfY) * zoom }
  ));
}