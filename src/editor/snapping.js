const SNAP_PX = 6;

export function snapPosition(candidatePdfX, candidatePdfY, candidateW, candidateH, otherObjects, zoom = 1, pageWidth = null, pageHeight = null) {
  let snapX = candidatePdfX;
  let snapY = candidatePdfY;
  let bestDX = null;
  let bestDY = null;
  let guidesX = [];
  let guidesY = [];
  const threshold = SNAP_PX / Math.max(zoom, 0.01);

  const candidateEdges = {
    left: candidatePdfX,
    right: candidatePdfX + candidateW,
    midX: candidatePdfX + candidateW / 2,
    bottom: candidatePdfY,
    top: candidatePdfY + candidateH,
    midY: candidatePdfY + candidateH / 2,
  };

  const applyDX = (delta, guides) => {
    if (Math.abs(delta) < threshold && (bestDX === null || Math.abs(delta) < Math.abs(bestDX))) {
      bestDX = delta;
      guidesX = guides;
    }
  };

  const applyDY = (delta, guides) => {
    if (Math.abs(delta) < threshold && (bestDY === null || Math.abs(delta) < Math.abs(bestDY))) {
      bestDY = delta;
      guidesY = guides;
    }
  };

  for (const obj of otherObjects) {
    const edges = {
      left: obj.pdfX,
      right: obj.pdfX + obj.width,
      top: obj.pdfY + obj.height,
      bottom: obj.pdfY,
      midX: obj.pdfX + obj.width / 2,
      midY: obj.pdfY + obj.height / 2,
    };

    const xPairs = [
      ['left', 'left'], ['left', 'right'], ['right', 'left'],
      ['right', 'right'], ['midX', 'midX'],
    ];
    for (const [ce, oe] of xPairs) {
      const delta = candidateEdges[ce] - edges[oe];
      applyDX(delta, [{ kind: 'line', axis: 'x', pdf: edges[oe] }]);
    }

    const yPairs = [
      ['bottom', 'bottom'], ['bottom', 'top'], ['top', 'bottom'],
      ['top', 'top'], ['midY', 'midY'],
    ];
    for (const [ce, oe] of yPairs) {
      const delta = candidateEdges[ce] - edges[oe];
      applyDY(delta, [{ kind: 'line', axis: 'y', pdf: edges[oe] }]);
    }
  }

  if (pageWidth !== null) {
    const pageX = [0, pageWidth / 2, pageWidth];
    for (const px of pageX) {
      const deltas = [
        candidateEdges.left - px,
        candidateEdges.midX - px,
        candidateEdges.right - px,
      ];
      for (const delta of deltas) {
        applyDX(delta, [{ kind: 'line', axis: 'x', pdf: px }]);
      }
    }
  }

  if (pageHeight !== null) {
    const pageY = [0, pageHeight / 2, pageHeight];
    for (const py of pageY) {
      const deltas = [
        candidateEdges.bottom - py,
        candidateEdges.midY - py,
        candidateEdges.top - py,
      ];
      for (const delta of deltas) {
        applyDY(delta, [{ kind: 'line', axis: 'y', pdf: py }]);
      }
    }
  }

  if (otherObjects.length >= 2) {
    const sortedX = [...otherObjects].sort((a, b) => a.pdfX - b.pdfX);
    const leftNeighbor = sortedX.filter(o => o.pdfX + o.width <= candidateEdges.left)
      .sort((a, b) => (b.pdfX + b.width) - (a.pdfX + a.width))[0];
    const rightNeighbor = sortedX.filter(o => o.pdfX >= candidateEdges.right)
      .sort((a, b) => a.pdfX - b.pdfX)[0];
    if (leftNeighbor && rightNeighbor) {
      const leftRight = leftNeighbor.pdfX + leftNeighbor.width;
      const rightLeft = rightNeighbor.pdfX;
      const targetLeft = (rightLeft + leftRight - candidateW) / 2;
      const delta = candidateEdges.left - targetLeft;
      const midY = candidateEdges.midY;
      applyDX(delta, [
        { kind: 'segment', axis: 'y', pdf: midY, from: leftRight, to: targetLeft },
        { kind: 'segment', axis: 'y', pdf: midY, from: targetLeft + candidateW, to: rightLeft },
      ]);
    }

    const sortedY = [...otherObjects].sort((a, b) => a.pdfY - b.pdfY);
    const lowerNeighbor = sortedY.filter(o => o.pdfY + o.height <= candidateEdges.bottom)
      .sort((a, b) => (b.pdfY + b.height) - (a.pdfY + a.height))[0];
    const upperNeighbor = sortedY.filter(o => o.pdfY >= candidateEdges.top)
      .sort((a, b) => a.pdfY - b.pdfY)[0];
    if (lowerNeighbor && upperNeighbor) {
      const lowerTop = lowerNeighbor.pdfY + lowerNeighbor.height;
      const upperBottom = upperNeighbor.pdfY;
      const targetBottom = (upperBottom + lowerTop - candidateH) / 2;
      const delta = candidateEdges.bottom - targetBottom;
      const midX = candidateEdges.midX;
      applyDY(delta, [
        { kind: 'segment', axis: 'x', pdf: midX, from: lowerTop, to: targetBottom },
        { kind: 'segment', axis: 'x', pdf: midX, from: targetBottom + candidateH, to: upperBottom },
      ]);
    }
  }

  if (bestDX !== null) snapX = candidatePdfX - bestDX;
  if (bestDY !== null) snapY = candidatePdfY - bestDY;

  return { snapX, snapY, guides: [...guidesX, ...guidesY] };
}

export function snapGuidesToScreen(guides, zoom, pageHeight) {
  return guides.map(g => {
    if (g.kind === 'segment' && g.axis === 'y') {
      return {
        kind: 'segment',
        axis: 'y',
        left: g.from * zoom,
        top: (pageHeight - g.pdf) * zoom,
        width: (g.to - g.from) * zoom,
        height: 1,
      };
    }
    if (g.kind === 'segment' && g.axis === 'x') {
      return {
        kind: 'segment',
        axis: 'x',
        left: g.pdf * zoom,
        top: (pageHeight - g.to) * zoom,
        width: 1,
        height: (g.to - g.from) * zoom,
      };
    }
    if (g.axis === 'x') {
      return { kind: 'line', axis: 'x', left: g.pdf * zoom };
    }
    return { kind: 'line', axis: 'y', top: (pageHeight - g.pdf) * zoom };
  });
}
