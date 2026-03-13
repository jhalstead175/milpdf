import { makeId } from '../utils/id';
import { identityTransform } from '../editor/Transform';

const PII_PATTERNS = [
  { id: 'ssn', label: 'Social Security Number', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g },
  { id: 'dob', label: 'Date of Birth', pattern: /\b(\d{2}\/\d{2}\/\d{4}|\d{2}\s(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s\d{4}|\d{8})\b/gi },
  { id: 'dodid', label: 'DoD ID', pattern: /\b\d{10}\b/g },
  { id: 'phone', label: 'Phone Number', pattern: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
];

export async function scanForPii(renderDoc, patterns = PII_PATTERNS) {
  const numPages = renderDoc.numPages;
  const findings = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await renderDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      const text = item.str || '';
      for (const { id, label, pattern } of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const [, , , d, tx, ty] = item.transform;
          const charWidth = item.width / Math.max(text.length, 1);
          const matchX = tx + match.index * charWidth;
          const matchW = match[0].length * charWidth;
          const matchH = Math.abs(d) * 1.4;

          findings.push({
            id: makeId(),
            type: 'redact',
            page: pageNum,
            pdfX: matchX - 2,
            pdfY: ty - 2,
            width: matchW + 4,
            height: matchH + 4,
            transform: identityTransform(),
            zIndex: 200,
            layerId: 'markup',
            locked: false,
            visible: true,
            groupId: null,
            _piiType: id,
            _piiLabel: label,
            _piiText: match[0],
          });
        }
      }
    }
  }

  return findings;
}
