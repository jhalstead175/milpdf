export function createModuleRegistry() {
  const modules = new Map();

  return {
    register(moduleDef) {
      if (!moduleDef?.id) throw new Error('Module must have id');
      modules.set(moduleDef.id, moduleDef);
    },
    initAll(ctx) {
      for (const moduleDef of modules.values()) {
        moduleDef.register?.(ctx);
      }
    },
    list() {
      return [...modules.keys()];
    },
  };
}
