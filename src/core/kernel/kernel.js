import { createCommandBus } from './commandBus';
import { createEventBus } from './eventBus';
import { createServiceContainer } from './serviceContainer';
import { createModuleRegistry } from './moduleRegistry';
import { loadPlugins, loadPluginsFromConfig } from './pluginLoader';

export function createKernel() {
  const commandBus = createCommandBus();
  const eventBus = createEventBus();
  const services = createServiceContainer();
  const modules = createModuleRegistry();
  let initialized = false;

  const ctx = {
    commandBus,
    eventBus,
    services,
    registerCommand: commandBus.register,
    registerService: services.register,
  };
  services.register('commandBus', commandBus);
  services.register('eventBus', eventBus);

  return {
    commandBus,
    eventBus,
    services,
    modules,
    init(coreModules = [], plugins = [], pluginCatalog = {}) {
      if (initialized) return;
      coreModules.forEach(mod => modules.register(mod));
      if (plugins.length > 0 && typeof plugins[0] === 'string') {
        loadPluginsFromConfig(modules, plugins, pluginCatalog);
      } else {
        loadPlugins(modules, plugins);
      }
      modules.initAll(ctx);
      initialized = true;
      eventBus.emit('kernel:ready', { modules: modules.list() });
    },
  };
}
