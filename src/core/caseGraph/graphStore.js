import { buildCaseGraph } from './graphBuilder';

export function createGraphStore() {
  let state = { nodes: [], edges: [] };

  return {
    getState() {
      return state;
    },
    setGraph(next) {
      state = next;
    },
    rebuild(params) {
      state = buildCaseGraph(params);
      return state;
    },
    queryNodesByType(type) {
      return state.nodes.filter(node => node.type === type);
    },
    queryEdgesByType(type) {
      return state.edges.filter(edge => edge.type === type);
    },
  };
}
