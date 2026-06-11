import { useState } from 'react';

const PRESETS = [
  { text: 'DRAFT', color: '#c0392b' },
  { text: 'APPROVED', color: '#1e7e34' },
  { text: 'FILED', color: '#1d4ed8' },
  { text: 'RECEIVED', color: '#475569' },
  { text: 'CONFIDENTIAL', color: '#c0392b' },
  { text: 'REVIEWED', color: '#7c3aed' },
];

export default function StampDialog({ onAdd, onClose }) {
  const [custom, setCustom] = useState('');
  const [color, setColor] = useState('#c0392b');
  const [withDate, setWithDate] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal stamp-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Add a Stamp</h3>
        <p className="modal-hint">Pick a preset, then click on the page to place it.</p>

        <div className="stamp-preset-grid">
          {PRESETS.map((p) => (
            <button
              key={p.text}
              type="button"
              className="stamp-preset"
              style={{ color: p.color, borderColor: p.color }}
              onClick={() => onAdd({ text: p.text, color: p.color, date: withDate })}
            >
              {p.text}
            </button>
          ))}
        </div>

        <h4 className="insert-section-label">Custom</h4>
        <div className="stamp-custom-row">
          <input
            type="text"
            placeholder="Custom text"
            value={custom}
            maxLength={40}
            onChange={(e) => setCustom(e.target.value)}
          />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color" />
          <button
            type="button"
            className="btn-primary"
            disabled={!custom.trim()}
            onClick={() => onAdd({ text: custom.trim(), color, date: withDate })}
          >
            Add
          </button>
        </div>

        <label className="stamp-date-toggle">
          <input type="checkbox" checked={withDate} onChange={(e) => setWithDate(e.target.checked)} />
          <span>Include today&apos;s date</span>
        </label>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
