export default function OcrProgressModal({ progress }) {
  const { phase, pageNum, index = 0, total = 0, progress: pct = 0 } = progress || {};

  let label = 'Preparing…';
  if (phase === 'embed') label = 'Embedding searchable text…';
  else if (phase === 'recognize' || phase === 'page') {
    label = `Recognizing page ${pageNum ?? '–'} (${Math.min(index + 1, total)} of ${total})`;
  } else if (phase === 'start') {
    label = `Found ${total} page${total === 1 ? '' : 's'} to scan…`;
  }

  const showBar = phase === 'recognize' || phase === 'page';

  return (
    <div className="modal-backdrop">
      <div className="modal ocr-progress" onClick={(e) => e.stopPropagation()}>
        <div className="milpdf-shimmer-loader" />
        <h3>Scan &amp; OCR</h3>
        <p className="ocr-progress-label">{label}</p>
        {showBar ? (
          <div className="ocr-progress-bar">
            <div className="ocr-progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
          </div>
        ) : null}
        <p className="modal-hint">Recognition runs entirely on your device.</p>
      </div>
    </div>
  );
}
