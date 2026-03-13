const SECTION_RULES = [
  {
    id: 'dd214',
    label: 'DD Form 214',
    icon: 'DD214',
    patterns: [/CERTIFICATE OF RELEASE OR DISCHARGE/i, /DD\s*FORM\s*214/i],
    color: '#3b82f6',
  },
  {
    id: 'dd214c',
    label: 'DD Form 214C',
    icon: 'DD214C',
    patterns: [/DD\s*FORM\s*214C/i, /CONTINUATION SHEET/i],
    color: '#3b82f6',
  },
  {
    id: 'va_rating',
    label: 'VA Rating Decision',
    icon: 'RATING',
    patterns: [/RATING DECISION/i, /DEPARTMENT OF VETERANS AFFAIRS/i, /SERVICE-CONNECTED/i],
    color: '#ef4444',
  },
  {
    id: 'va_21',
    label: 'VA Form 21 Series',
    icon: 'VA21',
    patterns: [/VA\s*FORM\s*21-/i, /VETERANS BENEFITS ADMINISTRATION/i],
    color: '#f59e0b',
  },
  {
    id: 'nexus_letter',
    label: 'Nexus Letter',
    icon: 'NEXUS',
    patterns: [/nexus/i, /medical opinion/i, /as likely as not/i, /in my medical opinion/i],
    color: '#8b5cf6',
  },
  {
    id: 'buddy_statement',
    label: 'Buddy Statement',
    icon: 'BUDDY',
    patterns: [/buddy statement/i, /lay statement/i, /21-4142/i, /witnessed/i],
    color: '#10b981',
  },
  {
    id: 'medical_record',
    label: 'Medical Record',
    icon: 'MED',
    patterns: [/MEDICAL RECORD/i, /CLINICAL NOTE/i, /SOAP NOTE/i, /CHIEF COMPLAINT/i,
      /DIAGNOSIS:/i, /PROGRESS NOTE/i],
    color: '#06b6d4',
  },
  {
    id: 'str',
    label: 'Service Treatment Record',
    icon: 'STR',
    patterns: [/SERVICE TREATMENT RECORD/i, /CHRONOLOGICAL RECORD/i, /MILITARY HEALTH/i],
    color: '#06b6d4',
  },
  {
    id: 'legal',
    label: 'Legal Document',
    icon: 'LEGAL',
    patterns: [/POWER OF ATTORNEY/i, /AGREEMENT/i, /WHEREAS/i, /AFFIDAVIT/i],
    color: '#6b7280',
  },
];
export async function analyzeDocumentStructure(renderDoc, onProgress) {
  const numPages = renderDoc.numPages;
  const sections = [];
  let lastSectionId = null;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) onProgress(pageNum / numPages);

    const page = await renderDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .slice(0, 40)
      .map(item => item.str)
      .join(' ')
      .trim()
      .substring(0, 300);

    const largestItem = textContent.items.reduce((best, item) => {
      const fontSize = Math.abs(item.transform[0]);
      return fontSize > (best ? Math.abs(best.transform[0]) : 0) ? item : best;
    }, null);

    let matchedRule = null;
    for (const rule of SECTION_RULES) {
      if (rule.patterns.some(p => p.test(pageText))) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule && matchedRule.id !== lastSectionId) {
      sections.push({
        id: `section-${pageNum}`,
        ruleId: matchedRule.id,
        label: matchedRule.label,
        icon: matchedRule.icon,
        color: matchedRule.color,
        startPage: pageNum,
        endPage: null,
        pageCount: null,
        heading: largestItem?.str ?? '',
        confidence: scoreConfidence(matchedRule, pageText),
      });

      if (sections.length > 1) {
        const prev = sections[sections.length - 2];
        prev.endPage = pageNum - 1;
        prev.pageCount = prev.endPage - prev.startPage + 1;
      }

      lastSectionId = matchedRule.id;
    } else if (largestItem && /^[A-Z\s]{5,}$/.test(largestItem.str.trim())) {
      const parent = sections[sections.length - 1];
      if (parent) {
        if (!parent.subsections) parent.subsections = [];
        parent.subsections.push({
          label: largestItem.str.trim(),
          page: pageNum,
        });
      }
    }
  }

  if (sections.length > 0) {
    const last = sections[sections.length - 1];
    last.endPage = numPages;
    last.pageCount = last.endPage - last.startPage + 1;
  }

  return sections;
}
function scoreConfidence(rule, text) {
  const matches = rule.patterns.filter(p => p.test(text)).length;
  return Math.min(1, matches / rule.patterns.length);
}
