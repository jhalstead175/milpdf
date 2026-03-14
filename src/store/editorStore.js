export function createEditorStore() {
  return {
    objects: [],
    setObjects(objects) {
      this.objects = objects;
    },
  };
}
