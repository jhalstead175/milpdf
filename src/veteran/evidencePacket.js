export const PACKET_TEMPLATES = {
  disability: {
    name: 'VA Disability Claim Packet',
    sections: [
      { id: 'cover', label: 'Cover Page', required: true, generated: true },
      { id: 'toc', label: 'Table of Contents', required: true, generated: true },
      { id: 'dd214', label: 'DD Form 214', required: true, generated: false },
      { id: 'str', label: 'Service Treatment Records', required: false, generated: false },
      { id: 'medical', label: 'Medical Records', required: false, generated: false },
      { id: 'nexus', label: 'Nexus Letter', required: false, generated: false },
      { id: 'buddy', label: 'Buddy Statements', required: false, generated: false, multi: true },
      { id: 'private_med', label: 'Private Medical Opinion', required: false, generated: false },
      { id: 'exhibits', label: 'Exhibits', required: false, generated: false, multi: true },
    ],
  },
  appeal: {
    name: 'Board of Veterans Appeals Packet',
    sections: [
      { id: 'cover', label: 'Cover Page', required: true, generated: true },
      { id: 'toc', label: 'Table of Contents', required: true, generated: true },
      { id: 'va10182', label: 'VA Form 10182', required: true, generated: false },
      { id: 'rating_dec', label: 'Rating Decision', required: true, generated: false },
      { id: 'rebuttal', label: 'Rebuttal Statement', required: false, generated: false },
      { id: 'new_evidence', label: 'New and Relevant Evidence', required: false, generated: false, multi: true },
    ],
  },
};

export function createPacketSection(templateSection, files = []) {
  return {
    id: templateSection.id,
    label: templateSection.label,
    generated: templateSection.generated,
    required: templateSection.required,
    enabled: true,
    files,
    exhibitLabel: null,
    tabLabel: null,
  };
}
