export function createEventBus() {
  const listeners = new Map();

  const on = (event, handler) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => off(event, handler);
  };

  const off = (event, handler) => {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler);
  };

  const emit = (event, payload) => {
    const set = listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  };

  return { on, off, emit };
}
