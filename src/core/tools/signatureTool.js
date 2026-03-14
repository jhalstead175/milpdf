export function createSignatureTool(ctx) {
  const {
    signatureDataUrl, onRequestSignature,
    screenRectToPdf, createBaseObject, onAddObject,
  } = ctx;

  return {
    onClick(_e, pos) {
      if (!signatureDataUrl) {
        onRequestSignature();
        return;
      }
      const rect = screenRectToPdf(pos.x, pos.y, 200, 80);
      onAddObject(createBaseObject('signature', rect, 'annotations', { dataUrl: signatureDataUrl }));
    },
  };
}
