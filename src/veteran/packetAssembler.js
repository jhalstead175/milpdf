import { PDFDocument } from 'pdf-lib';
import { generateCoverPage } from './coverPage';
import { generateTableOfContents } from './tableOfContents';

function getRangeIndices(file) {
  if (!file.pageRange || file.pageRange.length !== 2) return null;
  const start = Math.max(1, file.pageRange[0]);
  const end = Math.max(start, file.pageRange[1]);
  return { startIndex: start - 1, endIndex: end - 1 };
}

export async function assembleEvidencePacket(sections, profile, packetType, onProgress) {
  const finalDoc = await PDFDocument.create();
  const enabledSections = sections.filter(s => s.enabled);
  const pageOffsets = {};
  const sectionPageCounts = {};

  for (const section of enabledSections) {
    if (section.generated) {
      sectionPageCounts[section.id] = 1;
    } else {
      let count = 0;
      for (const file of section.files || []) {
        const srcDoc = await PDFDocument.load(file.bytes);
        const range = getRangeIndices(file);
        const total = srcDoc.getPageCount();
        const startIndex = range ? range.startIndex : 0;
        const endIndex = range ? range.endIndex : total - 1;
        count += (endIndex - startIndex + 1);
      }
      sectionPageCounts[section.id] = count;
    }
  }

  let offset = 1;
  for (const section of enabledSections) {
    pageOffsets[section.id] = offset;
    offset += sectionPageCounts[section.id] || 0;
  }
  for (let i = 0; i < enabledSections.length; i++) {
    const section = enabledSections[i];
    if (onProgress) onProgress((i + 1) / enabledSections.length);

    if (section.id === 'cover') {
      const coverBytes = await generateCoverPage(profile, packetType, section.claimSummary);
      const coverDoc = await PDFDocument.load(coverBytes);
      const [coverPage] = await finalDoc.copyPages(coverDoc, [0]);
      finalDoc.addPage(coverPage);
      continue;
    }

    if (section.id === 'toc') {
      const tocBytes = await generateTableOfContents(enabledSections, pageOffsets);
      const tocDoc = await PDFDocument.load(tocBytes);
      const [tocPage] = await finalDoc.copyPages(tocDoc, [0]);
      finalDoc.addPage(tocPage);
      continue;
    }

    for (const file of section.files || []) {
      const srcDoc = await PDFDocument.load(file.bytes);
      const range = getRangeIndices(file);
      const total = srcDoc.getPageCount();
      const startIndex = range ? range.startIndex : 0;
      const endIndex = range ? range.endIndex : total - 1;
      const indices = Array.from({ length: endIndex - startIndex + 1 }, (_, k) => startIndex + k);
      const pages = await finalDoc.copyPages(srcDoc, indices);
      pages.forEach(p => finalDoc.addPage(p));
    }
  }

  return finalDoc.save();
}
