import * as editorService from '../../services/editorService';

export const mergeDocuments = {
  name: 'merge_documents',
  description: 'Merge multiple PDF files',
  execute: async ({ files }) => editorService.merge(files),
};

export const splitDocument = {
  name: 'split_document',
  description: 'Split a PDF into a page range',
  execute: async ({ document, range }) => editorService.split(document, range),
};
