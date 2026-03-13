import { makeId } from './id';
import { identityTransform } from '../editor/Transform';

export async function detectFormFields(renderDoc, pageNum) {
  const page = await renderDoc.getPage(pageNum);
  const annotations = await page.getAnnotations();
  const fields = [];

  for (const ann of annotations) {
    if (ann.subtype !== 'Widget') continue;
    const [x1, y1, x2, y2] = ann.rect;

    fields.push({
      id: ann.id || makeId(),
      type: 'formField',
      page: pageNum,
      pdfX: x1,
      pdfY: y1,
      width: x2 - x1,
      height: y2 - y1,
      transform: identityTransform(),
      zIndex: 0,
      layerId: 'forms',
      locked: false,
      visible: true,
      groupId: null,
      fieldName: ann.fieldName,
      fieldType: ann.fieldType,
      fieldValue: ann.fieldValue ?? '',
      isCheckBox: ann.checkBox ?? false,
      isRadio: ann.radioButton ?? false,
      options: ann.options ?? [],
      readOnly: ann.readOnly ?? false,
      required: ann.required ?? false,
      maxLen: ann.maxLen ?? null,
    });
  }

  return fields;
}