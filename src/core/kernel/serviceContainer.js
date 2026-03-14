export function createServiceContainer() {
  const services = new Map();

  return {
    register(name, value) {
      services.set(name, value);
    },
    get(name) {
      return services.get(name);
    },
    has(name) {
      return services.has(name);
    },
    list() {
      return [...services.keys()];
    },
  };
}
