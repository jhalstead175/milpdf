import { useEffect, useState } from 'react';
import { analyzeDocumentStructure } from '../utils/documentAnalysis';

export default function DocumentNavigator({
  renderDoc,
  numPages,
  currentPage,
  onPageSelect,
}) {
  const [sections, setSections] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!renderDoc || numPages === 0) return;
    let cancelled = false;
    setAnalyzing(true);
    analyzeDocumentStructure(renderDoc, setProgress)
      .then((result) => {
        if (!cancelled) setSections(result);
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => { cancelled = true; };
  }, [renderDoc, numPages]);

  if (!renderDoc || numPages === 0) return null;

  return (
    <div className="doc-navigator">
      <div className="navigator-header">
        <span>Document Structure</span>
        {analyzing && <progress value={progress} max={1} />}
      </div>

      {sections.map((sec) => (
        <div
          key={sec.id}
          className={`nav-section ${currentPage >= sec.startPage && currentPage <= sec.endPage ? 'active' : ''}`}
          style={{ borderLeft: `3px solid ${sec.color}` }}
        >
          <div className="nav-section-header" onClick={() => onPageSelect(sec.startPage)}>
            <span className="nav-icon">{sec.icon}</span>
            <span className="nav-label">{sec.userLabel ?? sec.label}</span>
            <span className="nav-pages">p{sec.startPage}-{sec.endPage}</span>
          </div>
          {(sec.subsections || []).map((sub) => (
            <div key={`${sec.id}-${sub.page}`} className="nav-subsection" onClick={() => onPageSelect(sub.page)}>
              <span className="nav-sub-label">{sub.label}</span>
              <span className="nav-sub-page">p{sub.page}</span>
            </div>
          ))}
        </div>
      ))}

      {sections.length === 0 && !analyzing && (
        <div className="nav-empty">
          <p>No document sections detected.</p>
        </div>
      )}
    </div>
  );
}
