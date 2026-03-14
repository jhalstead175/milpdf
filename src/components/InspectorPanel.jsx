import { useMemo } from 'react';
import { identityTransform } from '../editor/Transform';

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '';
}

export default function InspectorPanel({
  selectedObjects = [],
  onUpdateObject,
}) {
  const obj = selectedObjects[0] || null;

  const transform = useMemo(() => (
    obj?.transform ?? identityTransform()
  ), [obj]);

  if (!obj) {
    return (
      <div className="panel inspector-panel">
        <div className="panel-header">Inspector</div>
        <div className="panel-body panel-empty">Select an object to inspect.</div>
      </div>
    );
  }

  const update = (patch) => onUpdateObject(obj.id, patch);
  const updateTransform = (patch) => update({ transform: { ...transform, ...patch } });

  return (
    <div className="panel inspector-panel">
      <div className="panel-header">Inspector</div>
      <div className="panel-body">
        <div className="field">
          <label>Name</label>
          <input
            type="text"
            value={obj.name || ''}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>X</label>
            <input
              type="number"
              value={formatNumber(obj.pdfX)}
              onChange={(e) => update({ pdfX: numberOr(e.target.value, obj.pdfX) })}
            />
          </div>
          <div className="field">
            <label>Y</label>
            <input
              type="number"
              value={formatNumber(obj.pdfY)}
              onChange={(e) => update({ pdfY: numberOr(e.target.value, obj.pdfY) })}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Width</label>
            <input
              type="number"
              value={formatNumber(obj.width)}
              onChange={(e) => update({ width: numberOr(e.target.value, obj.width) })}
            />
          </div>
          <div className="field">
            <label>Height</label>
            <input
              type="number"
              value={formatNumber(obj.height)}
              onChange={(e) => update({ height: numberOr(e.target.value, obj.height) })}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Rotation</label>
            <input
              type="number"
              value={formatNumber(transform.rotation || 0)}
              onChange={(e) => updateTransform({ rotation: numberOr(e.target.value, transform.rotation || 0) })}
            />
          </div>
          <div className="field">
            <label>Opacity</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={formatNumber(obj.opacity ?? 1)}
              onChange={(e) => update({ opacity: numberOr(e.target.value, obj.opacity ?? 1) })}
            />
          </div>
        </div>

        <div className="field-row">
          <label className="field-inline">
            <input
              type="checkbox"
              checked={obj.visible !== false}
              onChange={() => update({ visible: obj.visible === false })}
            />
            Visible
          </label>
          <label className="field-inline">
            <input
              type="checkbox"
              checked={obj.locked === true}
              onChange={() => update({ locked: !obj.locked })}
            />
            Locked
          </label>
        </div>

        <div className="field">
          <label>Type</label>
          <div className="readonly">{obj.type}</div>
        </div>

        {obj.type === 'text' && (
          <>
            <div className="field">
              <label>Text</label>
              <textarea
                value={obj.text || ''}
                onChange={(e) => update({ text: e.target.value })}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Font Size</label>
                <input
                  type="number"
                  value={formatNumber(obj.fontSize || 16)}
                  onChange={(e) => update({ fontSize: numberOr(e.target.value, obj.fontSize || 16) })}
                />
              </div>
              <div className="field">
                <label>Line Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formatNumber(obj.lineHeight || 1.2)}
                  onChange={(e) => update({ lineHeight: numberOr(e.target.value, obj.lineHeight || 1.2) })}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Color</label>
                <input
                  type="color"
                  value={obj.color || '#000000'}
                  onChange={(e) => update({ color: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Align</label>
                <select
                  value={obj.alignment || 'left'}
                  onChange={(e) => update({ alignment: e.target.value })}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </>
        )}

        {obj.type === 'highlight' && (
          <div className="field-row">
            <div className="field">
              <label>Color</label>
              <input
                type="color"
                value={obj.color || '#f9e2af'}
                onChange={(e) => update({ color: e.target.value })}
              />
            </div>
          </div>
        )}

        {obj.type === 'redact' && (
          <div className="field-row">
            <div className="field">
              <label>Color</label>
              <input
                type="color"
                value={obj.color || '#000000'}
                onChange={(e) => update({ color: e.target.value })}
              />
            </div>
          </div>
        )}

        {obj.type === 'whiteout' && (
          <div className="field-row">
            <div className="field">
              <label>Color</label>
              <input
                type="color"
                value={obj.color || '#ffffff'}
                onChange={(e) => update({ color: e.target.value })}
              />
            </div>
          </div>
        )}

        {obj.type === 'drawing' && (
          <div className="field-row">
            <div className="field">
              <label>Color</label>
              <input
                type="color"
                value={obj.color || '#000000'}
                onChange={(e) => update({ color: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Line Width</label>
              <input
                type="number"
                value={formatNumber(obj.lineWidth || 2)}
                onChange={(e) => update({ lineWidth: numberOr(e.target.value, obj.lineWidth || 2) })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
