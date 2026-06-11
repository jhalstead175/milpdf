import { useState } from 'react';

const POSITIONS = [
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-left', label: 'Top left' },
];

const PAGE_FORMATS = [
  { value: 'Page {n} of {total}', label: 'Page 1 of N' },
  { value: '{n} of {total}', label: '1 of N' },
  { value: 'Page {n}', label: 'Page 1' },
  { value: '{n}', label: '1' },
  { value: '- {n} -', label: '- 1 -' },
];

export default function NumberingDialog({ mode, onApply, onClose }) {
  const isBates = mode === 'bates';
  const [prefix, setPrefix] = useState('MILPDF-');
  const [padding, setPadding] = useState(6);
  const [format, setFormat] = useState(PAGE_FORMATS[0].value);
  const [startNumber, setStartNumber] = useState(1);
  const [position, setPosition] = useState(isBates ? 'bottom-right' : 'bottom-center');

  const handleApply = () => {
    const start = Math.max(0, parseInt(startNumber, 10) || 0);
    if (isBates) {
      onApply({ prefix, startNumber: start, padding: Math.max(1, parseInt(padding, 10) || 1), position });
    } else {
      onApply({ format, startNumber: start, position });
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal numbering-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{isBates ? 'Bates Numbering' : 'Page Numbers'}</h3>
        <p className="modal-hint">
          {isBates
            ? 'Stamp a sequential Bates label on every page.'
            : 'Add a page number to every page.'}
        </p>

        {isBates ? (
          <>
            <label className="numbering-field">
              <span>Prefix</span>
              <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </label>
            <label className="numbering-field">
              <span>Digits</span>
              <input type="number" min="1" max="10" value={padding} onChange={(e) => setPadding(e.target.value)} />
            </label>
          </>
        ) : (
          <label className="numbering-field">
            <span>Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {PAGE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
        )}

        <label className="numbering-field">
          <span>Start at</span>
          <input type="number" min="0" value={startNumber} onChange={(e) => setStartNumber(e.target.value)} />
        </label>
        <label className="numbering-field">
          <span>Position</span>
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>

        {isBates ? (
          <p className="numbering-preview">
            Preview: <strong>{`${prefix}${String(Math.max(0, parseInt(startNumber, 10) || 0)).padStart(Math.max(1, parseInt(padding, 10) || 1), '0')}`}</strong>
          </p>
        ) : null}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleApply}>Apply to all pages</button>
        </div>
      </div>
    </div>
  );
}
