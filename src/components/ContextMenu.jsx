import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const closeOnEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', closeOnEsc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', closeOnEsc);
    };
  }, [onClose]);

  // Keep menu within viewport
  const style = { position: 'fixed', left: x, top: y, zIndex: 9000 };

  return (
    <div ref={ref} className="ctx-menu" style={style} onContextMenu={e => e.preventDefault()}>
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={`div-${i}`} className="ctx-menu-divider" />;
        }
        return (
          <button
            key={item.label}
            type="button"
            className="ctx-menu-item"
            disabled={item.disabled}
            onClick={() => { item.onClick?.(); onClose(); }}
          >
            <span className="ctx-menu-label">{item.label}</span>
            {item.shortcut ? <span className="ctx-menu-shortcut">{item.shortcut}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
