function groupByExhibit(markers = []) {
  const map = new Map();
  for (const marker of markers) {
    const key = marker.exhibitId || 'unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(marker);
  }
  return map;
}

export function detectContradictions({ evidenceIndex, documentIndex }) {
  const results = [];
  if (!evidenceIndex || !documentIndex) return results;

  const moneyByPage = new Map();
  for (const entity of documentIndex.entities || []) {
    if (entity.type !== 'money') continue;
    if (!moneyByPage.has(entity.page)) moneyByPage.set(entity.page, []);
    moneyByPage.get(entity.page).push(entity.text);
  }

  const exhibits = groupByExhibit(evidenceIndex.markers || []);
  for (const [exhibitId, markers] of exhibits.entries()) {
    const pageMoney = [];
    for (const marker of markers) {
      const amounts = moneyByPage.get(marker.page) || [];
      if (amounts.length > 1) {
        pageMoney.push({ page: marker.page, amounts });
      }
    }
    if (pageMoney.length > 0) {
      results.push({
        type: 'conflicting_amounts',
        exhibitId,
        details: pageMoney,
      });
    }
  }

  return results;
}
