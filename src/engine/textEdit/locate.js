// Hit-testing: map a PDF-space point to the text run under it.
//
// Phase 2 of in-place editing. extractTextRuns gives a run's baseline x/y and
// font size but not its width, so we estimate a bounding box from font size and
// character count. That's enough to PICK a run on click; exact widths (embedded
// font metrics / pdf.js item widths) can refine this later without changing the
// interface.

const AVG_CHAR_EM = 0.5;  // average glyph advance for a Helvetica-like face
const ASCENT_EM = 0.75;   // above baseline
const DESCENT_EM = 0.25;  // below baseline

export function estimateRunWidth(run) {
  const len = run.text ? run.text.length : 0;
  return len * (run.fontSize || 0) * AVG_CHAR_EM;
}

export function estimateRunBox(run) {
  const size = run.fontSize || 0;
  return {
    x0: run.x,
    y0: run.y - size * DESCENT_EM,
    x1: run.x + estimateRunWidth(run),
    y1: run.y + size * ASCENT_EM,
  };
}

// Returns the topmost run whose estimated box contains the point, or null.
// Later runs paint on top, so the last containing run wins.
export function locateTextRunAtPoint(runs, point) {
  let hit = null;
  for (const run of runs) {
    const b = estimateRunBox(run);
    if (point.x >= b.x0 && point.x <= b.x1 && point.y >= b.y0 && point.y <= b.y1) hit = run;
  }
  return hit;
}
