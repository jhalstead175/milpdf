import * as intelligence from '../intelligence';
import * as evidence from '../evidence';
import * as caseGraph from '../caseGraph';
import * as ai from '../ai';

export const CORE_MODULES = [
  {
    id: 'intelligence',
    register: ({ registerService }) => {
      registerService('intelligence', intelligence);
    },
  },
  {
    id: 'evidence',
    register: ({ registerService, registerCommand }) => {
      registerService('evidence', evidence);
      registerCommand('evidence.exportBundle', evidence.exportEvidenceBundle);
    },
  },
  {
    id: 'caseGraph',
    register: ({ registerService }) => {
      registerService('caseGraph', caseGraph);
    },
  },
  {
    id: 'ai',
    register: ({ registerService }) => {
      registerService('ai', ai);
    },
  },
];
