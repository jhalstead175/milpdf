export function createPdfEngine() {
  return {
    load: (file) => ({ file }),
  };
}
