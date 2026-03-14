export function loadPlugins(moduleRegistry, plugins = []) {
  for (const plugin of plugins) {
    moduleRegistry.register(plugin);
  }
}

export function loadPluginsFromConfig(moduleRegistry, pluginIds = [], catalog = {}) {
  for (const id of pluginIds) {
    const plugin = catalog[id];
    if (plugin) {
      moduleRegistry.register(plugin);
    } else {
      console.warn(`Kernel: plugin not found for id "${id}"`);
    }
  }
}
