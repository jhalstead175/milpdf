const DEFAULT_OPTIONS = {
  lineYThreshold: 3,
  minTableRows: 3,
  minTableCols: 3,
};

const ENTITY_PATTERNS = [
  { type: 'date', pattern: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})\b/g },
  { type: 'money', pattern: /\b\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g },
  { type: 'email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: 'phone', pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
];

function normalizeText(text) {
  return String(text || '').trim();
}

function extractWordFromItem(item, pageNum) {
  const text = normalizeText(item.str);
  if (!text) return null;
  const [a, _b, _c, d, e, f] = item.transform;
  const width = item.width || Math.abs(a);
  const height = Math.max(1, Math.abs(d) || Math.abs(a));
  return {
    page: pageNum,
    text,
    x: e,
    y: f,
    width,
    height,
  };
}

export async function extractWords(renderDoc, pageNum) {
  const page = await renderDoc.getPage(pageNum);
  const textContent = await page.getTextContent();
  const words = [];
  for (const item of textContent.items) {
    const word = extractWordFromItem(item, pageNum);
    if (word) words.push(word);
  }
  return words;
}

export function groupWordsIntoLines(words, options = {}) {
  const { lineYThreshold } = { ...DEFAULT_OPTIONS, ...options };
  const sorted = [...words].sort((a, b) => {
    if (Math.abs(b.y - a.y) > lineYThreshold) return b.y - a.y;
    return a.x - b.x;
  });

  const lines = [];
  for (const word of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - word.y) <= lineYThreshold) {
      last.words.push(word);
      last.text = `${last.text} ${word.text}`.trim();
      last.x2 = Math.max(last.x2, word.x + word.width);
      last.y = (last.y + word.y) / 2;
      last.height = Math.max(last.height, word.height);
    } else {
      lines.push({
        page: word.page,
        y: word.y,
        height: word.height,
        x: word.x,
        x2: word.x + word.width,
        text: word.text,
        words: [word],
      });
    }
  }

  return lines.map(line => ({
    page: line.page,
    text: line.text,
    words: line.words.sort((a, b) => a.x - b.x),
    x: line.x,
    y: line.y,
    width: line.x2 - line.x,
    height: line.height,
  }));
}

function findEntityBounds(line, matchIndex, matchText) {
  const words = line.words || [];
  let cursor = 0;
  let startWord = null;
  let endWord = null;
  for (const word of words) {
    const wordText = word.text;
    const spanStart = cursor;
    const spanEnd = cursor + wordText.length;
    const matchStart = matchIndex;
    const matchEnd = matchIndex + matchText.length;
    if (matchEnd >= spanStart && matchStart <= spanEnd) {
      if (!startWord) startWord = word;
      endWord = word;
    }
    cursor = spanEnd + 1;
  }
  if (!startWord || !endWord) return null;
  const x = Math.min(startWord.x, endWord.x);
  const x2 = Math.max(startWord.x + startWord.width, endWord.x + endWord.width);
  return {
    x,
    y: line.y,
    width: x2 - x,
    height: Math.max(startWord.height, endWord.height),
  };
}

export function detectEntities(lines) {
  const entities = [];
  for (const line of lines) {
    for (const { type, pattern } of ENTITY_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line.text)) !== null) {
        const bounds = findEntityBounds(line, match.index, match[0]);
        entities.push({
          type,
          text: match[0],
          page: line.page,
          ...bounds,
        });
      }
    }
  }
  return entities;
}

export async function detectForms(renderDoc, pageNum) {
  const page = await renderDoc.getPage(pageNum);
  const annotations = await page.getAnnotations();
  const forms = [];
  for (const ann of annotations || []) {
    if (!ann.fieldName) continue;
    forms.push({
      page: pageNum,
      fieldName: ann.fieldName,
      fieldType: ann.fieldType,
      rect: ann.rect || null,
    });
  }
  return forms;
}

function clusterColumns(lines) {
  const buckets = new Map();
  for (const line of lines) {
    for (const word of line.words || []) {
      const key = Math.round(word.x / 10) * 10;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }
  return [...buckets.keys()].sort((a, b) => a - b);
}

export function detectTables(lines, options = {}) {
  const { minTableRows, minTableCols } = { ...DEFAULT_OPTIONS, ...options };
  const tables = [];
  const columns = clusterColumns(lines);
  if (columns.length < minTableCols) return tables;

  const rows = lines.filter(line => (line.words || []).length >= minTableCols);
  if (rows.length < minTableRows) return tables;

  const xs = rows.flatMap(line => line.words.map(word => word.x));
  const ys = rows.map(line => line.y);
  const x2 = rows.flatMap(line => line.words.map(word => word.x + word.width));
  const height = rows.reduce((acc, line) => Math.max(acc, line.height), 0);
  if (xs.length === 0 || ys.length === 0) return tables;

  tables.push({
    page: rows[0].page,
    x: Math.min(...xs),
    y: Math.min(...ys) - height,
    width: Math.max(...x2) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys) + height,
    columns: columns.length,
    rows: rows.length,
  });
  return tables;
}

export async function buildDocumentIndex(renderDoc, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pages = [];
  const words = [];
  const lines = [];
  const entities = [];
  const tables = [];
  const forms = [];

  for (let pageNum = 1; pageNum <= renderDoc.numPages; pageNum++) {
    const pageWords = await extractWords(renderDoc, pageNum);
    const pageLines = groupWordsIntoLines(pageWords, opts);
    const pageEntities = detectEntities(pageLines);
    const pageTables = detectTables(pageLines, opts);
    const pageForms = await detectForms(renderDoc, pageNum);

    pages.push({
      page: pageNum,
      words: pageWords,
      lines: pageLines,
      entities: pageEntities,
      tables: pageTables,
      forms: pageForms,
    });

    words.push(...pageWords);
    lines.push(...pageLines);
    entities.push(...pageEntities);
    tables.push(...pageTables);
    forms.push(...pageForms);
  }

  return {
    words,
    lines,
    entities,
    tables,
    forms,
    pages,
  };
}
