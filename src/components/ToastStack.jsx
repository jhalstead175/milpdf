import { useEffect } from 'react';

export default function ToastStack({ toasts, onDismiss }) {
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map(t => (
      setTimeout(() => onDismiss(t.id), t.duration || 3000)
    ));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type || 'info'}`}>
          <div className="toast-title">{t.title}</div>
          {t.message && <div className="toast-message">{t.message}</div>}
        </div>
      ))}
    </div>
  );
}
