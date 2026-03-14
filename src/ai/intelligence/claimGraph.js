export function buildClaimGraph(events = []) {
  return {
    nodes: events,
    edges: events.map((event, index) => ({
      from: events[index],
      to: events[index + 1],
    })).filter(edge => edge.to),
  };
}
