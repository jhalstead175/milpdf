import * as evidenceService from '../../services/evidenceService';

export const tagEvidence = {
  name: 'tag_evidence',
  description: 'Tag a piece of evidence for the case.',
  execute: async ({ item }) => evidenceService.tagEvidence(item),
};
