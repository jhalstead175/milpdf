export const PLUGIN_CATALOG = {
  eventLogger: {
    id: 'eventLogger',
    register: ({ eventBus }) => {
      eventBus.on('document:loaded', (payload) => {
        console.info('[plugin:eventLogger] document:loaded', payload);
      });
      eventBus.on('annotation:created', (payload) => {
        console.info('[plugin:eventLogger] annotation:created', payload);
      });
      eventBus.on('evidence:created', (payload) => {
        console.info('[plugin:eventLogger] evidence:created', payload);
      });
      eventBus.on('timeline:updated', (payload) => {
        console.info('[plugin:eventLogger] timeline:updated', payload);
      });
    },
  },
  healthCheck: {
    id: 'healthCheck',
    register: ({ registerCommand, services }) => {
      registerCommand('plugin.health.check', () => ({
        services: services.list(),
        timestamp: new Date().toISOString(),
      }));
    },
  },
};
