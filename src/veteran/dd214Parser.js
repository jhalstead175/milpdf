const FIELD_PATTERNS = {
  fullName: /[A-Z]+,\s+[A-Z]+(\s+[A-Z]+)?/,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
  branch: /ARMY|NAVY|AIR FORCE|MARINE|COAST GUARD|SPACE FORCE/i,
  rank: /\b[EOW]\d\b/,
  entryDate: /\b\d{8}\b/,
  separationDate: /\b\d{8}\b/,
};

export async function parseDD214(renderDoc, pageNum = 1) {
  const page = await renderDoc.getPage(pageNum);
  const annotations = await page.getAnnotations();
  const formFields = {};
  for (const ann of annotations) {
    if (ann.fieldName && ann.fieldValue) {
      formFields[ann.fieldName] = ann.fieldValue;
    }
  }

  const textContent = await page.getTextContent();
  const pageText = textContent.items.map(item => item.str).join(' ');

  const extracted = {
    fullName: formFields['Last, First, Middle Name'] || matchValue(pageText, FIELD_PATTERNS.fullName),
    ssn: formFields['SSN'] || matchValue(pageText, FIELD_PATTERNS.ssn),
    branch: formFields['Branch'] || matchValue(pageText, FIELD_PATTERNS.branch),
    rank: formFields['Pay Grade'] || matchValue(pageText, FIELD_PATTERNS.rank),
    entryDate: formFields['Date Entered AD YYYYMMDD'] || matchValue(pageText, FIELD_PATTERNS.entryDate),
    separationDate: formFields['Separation Date YYYYMMDD'] || matchValue(pageText, FIELD_PATTERNS.separationDate),
  };

  return {
    detected: true,
    confidence: Object.values(extracted).filter(Boolean).length / Object.keys(extracted).length,
    fields: extracted,
    raw: formFields,
  };
}

function matchValue(text, pattern) {
  const match = text.match(pattern);
  return match ? match[0] : '';
}
