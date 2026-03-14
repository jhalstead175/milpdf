export function summarizeEvidence(items = []) {
  return items.map(item => item.label || item).join('\n');
}
