import * as claimService from '../../services/claimService';

export const buildClaimPacket = {
  name: 'build_claim_packet',
  description: 'Assemble a claim packet from evidence.',
  execute: async ({ data }) => claimService.buildClaimPacket(data),
};
