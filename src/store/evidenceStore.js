export function createEvidenceStore() {
  return {
    evidence: [],
    addEvidence(item) {
      this.evidence = [...this.evidence, item];
    },
  };
}
