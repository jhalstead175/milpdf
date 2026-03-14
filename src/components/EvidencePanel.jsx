import { useMemo, useState } from 'react';

export default function EvidencePanel({
  markers = [],
  exhibits = [],
  onJumpToPage,
  onExportBundle,
}) {
  const [prefix, setPrefix] = useState('MILPDF-');
  const [startNumber, setStartNumber] = useState(1);

  const exhibitList = useMemo(() => (
    exhibits.length > 0 ? exhibits : [{ id: 'unassigned', label: 'Unassigned', markers: markers }]
  ), [exhibits, markers]);

  return (
    <div className="panel evidence-panel">
      <div className="panel-header">Evidence</div>
      <div className="panel-body">
        <div className="evidence-export">
          <div className="field-row">
            <div className="field">
              <label>Bates Prefix</label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Start #</label>
              <input
                type="number"
                min="1"
                value={startNumber}
                onChange={(e) => setStartNumber(Number(e.target.value) || 1)}
              />
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => onExportBundle?.({ prefix, startNumber })}
          >
            Export Evidence Bundle
          </button>
        </div>

        {exhibitList.length === 0 && (
          <div className="panel-empty">No evidence markers yet.</div>
        )}

        {exhibitList.map(exhibit => (
          <div key={exhibit.id} className="evidence-exhibit">
            <div className="evidence-exhibit-title">
              {exhibit.label}
              <span className="evidence-count">{exhibit.markers?.length || 0}</span>
            </div>
            {(exhibit.markers || []).map(marker => (
              <button
                key={marker.id}
                className="evidence-marker"
                onClick={() => onJumpToPage?.(marker.page)}
              >
                <span className="evidence-label">{marker.label}</span>
                <span className="evidence-page">p{marker.page}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
