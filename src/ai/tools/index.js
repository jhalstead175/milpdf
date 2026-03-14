import { mergeDocuments, splitDocument } from './pdfTools';
import { tagEvidence } from './evidenceTools';
import { buildClaimPacket } from './claimTools';

export const tools = {
  merge_documents: mergeDocuments,
  split_document: splitDocument,
  tag_evidence: tagEvidence,
  build_claim_packet: buildClaimPacket,
};
