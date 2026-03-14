export function createCommandBus() {
  const handlers = new Map();

  return {
    register(id, handler) {
      handlers.set(id, handler);
    },
    unregister(id) {
      handlers.delete(id);
    },
    execute(id, payload) {
      const handler = handlers.get(id);
      if (!handler) throw new Error(`Command not registered: ${id}`);
      return handler(payload);
    },
    list() {
      return [...handlers.keys()];
    },
  };
}
