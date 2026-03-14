import { useMemo, useState } from 'react';

export default function LayersPanel({
  objects = [],
  selectionIds = [],
  onSelectionChange,
  onToggleVisible,
  onToggleLocked,
  onReorder,
}) {
  const [dragId, setDragId] = useState(null);
  const selectionSet = useMemo(() => new Set(selectionIds), [selectionIds]);

  const ordered = useMemo(() => (
    [...objects].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
  ), [objects]);

  const handleSelect = (e, id) => {
    if (e.shiftKey) {
      const next = new Set(selectionSet);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange([...next]);
      return;
    }
    onSelectionChange([id]);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const ids = ordered.map(o => o.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
    setDragId(null);
  };

  return (
    <div className="panel layers-panel">
      <div className="panel-header">Layers</div>
      <div className="panel-body">
        {ordered.length === 0 && (
          <div className="panel-empty">No objects on this page.</div>
        )}
        {ordered.map(obj => {
          const selected = selectionSet.has(obj.id);
          const name = obj.name || `${obj.type} ${String(obj.id).slice(0, 6)}`;
          return (
            <div
              key={obj.id}
              className={`layer-row ${selected ? 'selected' : ''} ${obj.visible === false ? 'is-hidden' : ''}`}
              onClick={(e) => handleSelect(e, obj.id)}
              draggable
              onDragStart={() => setDragId(obj.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, obj.id)}
            >
              <div className="layer-name">
                <span className="layer-type">{obj.type}</span>
                <span className="layer-title">{name}</span>
              </div>
              <div className="layer-actions">
                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); onToggleVisible(obj.id); }}
                  title={obj.visible === false ? 'Show' : 'Hide'}
                >
                  {obj.visible === false ? 'Show' : 'Hide'}
                </button>
                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); onToggleLocked(obj.id); }}
                  title={obj.locked ? 'Unlock' : 'Lock'}
                >
                  {obj.locked ? 'Unlock' : 'Lock'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
