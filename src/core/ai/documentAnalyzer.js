function summarizeLines(lines, maxLines = 6) {
  const summary = [];
  for (const line of lines) {
    if (!line.text) continue;
    summary.push(line.text.trim());
    if (summary.length >= maxLines) break;
  }
  return summary;
}

export function summarizeDocument(documentIndex, maxPages = 3) {
  if (!documentIndex) return { summary: [], sources: [] };
  const summaries = [];
  const sources = [];

  const pages = documentIndex.pages.slice(0, maxPages);
  for (const page of pages) {
    const lines = page.lines || [];
    const pageSummary = summarizeLines(lines);
    if (pageSummary.length > 0) {
      summaries.push(`Page ${page.page}: ${pageSummary.join(' ')}`);
      sources.push({ page: page.page, lines: pageSummary });
    }
  }

  return {
    summary: summaries,
    sources,
  };
}
