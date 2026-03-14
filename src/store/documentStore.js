export function createDocumentStore() {
  return {
    current: null,
    setDocument(doc) {
      this.current = doc;
    },
  };
}
