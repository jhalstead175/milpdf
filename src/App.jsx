import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import LandingPage from './components/LandingPage';
import './components/LandingPage.css';
import AppShell from './app/AppShell';
import PrimaryNav from './app/layout/PrimaryNav';
import GlobalTopBar from './app/layout/GlobalTopBar';
import StatusBar from './app/layout/StatusBar';
import InboxWorkspace from './app/workspaces/InboxWorkspace';
import ReviewWorkspace from './app/workspaces/ReviewWorkspace';
import FindingsWorkspace from './app/workspaces/FindingsWorkspace';
import EvidenceWorkspace from './app/workspaces/EvidenceWorkspace';
import PacketWorkspace from './app/workspaces/PacketWorkspace';
import ExportWorkspace from './app/workspaces/ExportWorkspace';
import AssistantDock from './app/panels/AssistantDock';
import { WORKSPACE_ITEMS } from './app/config/navigation';
import { useWorkspaceStore } from './app/state/useWorkspaceStore';
import { useFindingsStore } from './app/state/useFindingsStore';
import CommandPalette from './components/CommandPalette';
import SignaturePad from './components/SignaturePad';
import ProfileModal from './components/ProfileModal';
import ToastStack from './components/ToastStack';
import ActionReviewModal from './components/ActionReviewModal';
import { useEditorStore } from './core/sceneGraph/store';
import {
  loadPdf, deletePage, reorderPages, rotatePage,
  addBlankPage, mergePdf, insertPdf, cropPage, imagesToPdf,
  saveWithDialog, downloadBlob, addWatermark, splitPdf, printPdf,
} from './utils/pdfUtils';
import { secureEmbed } from './core/export';
import { toEngineDocument, documentToEmbedObjects } from './engine/adapter';
import { detectFormFields } from './utils/formDetection';
import { convertPdfToWord } from './utils/wordExport';
import { copyObjects, pasteObjects, duplicateObjects } from './editor/clipboard';
import { scanForPii } from './veteran/autoRedact';
import { parseDD214 } from './veteran/dd214Parser';
import { loadProfile, saveProfile, normalizeProfile } from './veteran/profile';
import { FORM_PROFILES, detectFormProfile, autofillScene } from './veteran/formProfiles';
import EvidenceBuilder from './veteran/EvidenceBuilder';
import {
  alignLeft, alignRight, alignTop, alignBottom,
  alignCenterH, alignCenterV,
  distributeHorizontally, distributeVertically,
} from './editor/alignment';
import { bringForward, sendBackward, bringToFront, sendToBack } from './editor/zorder';
import { buildCommandRegistry } from './core/commands/registry';
import { buildShortcutMap, eventToShortcut } from './core/commands/executor';
import { buildEvidenceIndex } from './core/evidence';
import { buildCaseGraph } from './core/caseGraph';
import { buildCaseContext, askAva } from './core/ai';
import './App.css';

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

let pageMetaSeed = 0;
let phase3EntitySeed = 0;

function nextPageMetaId() {
  pageMetaSeed += 1;
  return `page-meta-${pageMetaSeed}`;
}

function nextPhase3Id(prefix) {
  phase3EntitySeed += 1;
  return `${prefix}-${phase3EntitySeed}`;
}

function buildPageMetaFromDoc(doc, pageIds = []) {
  return doc.getPages().map((page, index) => ({
    id: pageIds[index] ?? nextPageMetaId(),
    number: index + 1,
    width: page.getWidth(),
    height: page.getHeight(),
    rotation: page.getRotation().angle || 0,
  }));
}

function attachPageIds(objects, pageMeta) {
  const pageIdByNumber = new Map(pageMeta.map((meta) => [meta.number, meta.id]));
  return objects.map((obj) => {
    if (obj.pageId) return obj;
    const nextPageId = pageIdByNumber.get(obj.page);
    return nextPageId ? { ...obj, pageId: nextPageId } : obj;
  });
}

function getActiveToolLabel(tool) {
  if (tool === 'highlight') return 'Highlight';
  if (tool === 'draw') return 'Draw';
  if (tool === 'text') return 'Text';
  if (tool === 'signature') return 'Note';
  if (tool === 'edit') return 'Eraser';
  return 'Select';
}

function triggerJsonDownload(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildAssistantActionCatalog({ currentPage, hasDocument }) {
  return [
    {
      id: 'summarize_page',
      label: 'Summarize current page',
      description: 'Capture the most important evidence on the active page.',
      scope: `Page ${currentPage}`,
      outputLabel: 'Page summary finding',
      reviewLabel: 'Review before promoting to evidence',
      notes: [
        'Runs against the current page context.',
        'Creates a structured finding instead of editing the document.',
        'Leaves final evidence promotion to the reviewer.',
      ],
      prompt: `Summarize page ${currentPage} and list the most important evidence points.`,
      disabled: !hasDocument,
    },
    {
      id: 'extract_dates',
      label: 'Extract dates',
      description: 'Generate a date-focused review queue for the current document.',
      scope: 'Current document',
      outputLabel: 'Timeline-oriented findings',
      reviewLabel: 'Review before packet use',
      notes: [
        'Extracts dates and why they matter.',
        'Creates findings that can be accepted or rejected.',
        'Does not alter the PDF.',
      ],
      prompt: 'Extract every important date from the current document and explain why each matters.',
      disabled: !hasDocument,
    },
    {
      id: 'find_pii',
      label: 'Find PII',
      description: 'Detect likely personal information before redaction or export.',
      scope: 'Current document',
      outputLabel: 'Sensitive-data findings',
      reviewLabel: 'Review before applying redactions',
      notes: [
        'Scans text for likely SSNs, dates of birth, phone numbers, and DoD IDs.',
        'Creates findings and does not automatically redact.',
        'Lets the reviewer decide what becomes a redaction.',
      ],
      prompt: 'Identify possible SSNs, dates of birth, addresses, and other personal information that may need redaction.',
      disabled: !hasDocument,
    },
    {
      id: 'draft_exhibit_note',
      label: 'Draft exhibit note',
      description: 'Create a concise summary that can be promoted into evidence.',
      scope: 'Current page or document',
      outputLabel: 'Evidence draft',
      reviewLabel: 'Review before packet inclusion',
      notes: [
        'Uses the current page context for a concise summary.',
        'Creates an evidence draft, not a final packet artifact.',
        'Keeps all output editable before export.',
      ],
      prompt: 'Draft a concise exhibit note for the current page or document.',
      disabled: !hasDocument,
    },
  ];
}

function App() {
  const [view, setView] = useState('landing');
  const [toasts, setToasts] = useState([]);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const {
    workspace,
    setWorkspace,
    assistantOpen,
    toggleAssistant,
    reviewPanelTab,
    setReviewPanelTab,
    commandPaletteOpen,
    setCommandPaletteOpen,
  } = useWorkspaceStore(isElectron ? 'review' : 'inbox');
  const {
    findings,
    addFindings,
    activeFilter: findingsFilter,
    setActiveFilter: setFindingsFilter,
    selectedFindingId,
    setSelectedFindingId,
    acceptFinding,
    rejectFinding,
    updateFinding,
  } = useFindingsStore();
  const [assistantRunHistory, setAssistantRunHistory] = useState([]);
  const [assistantActionProposal, setAssistantActionProposal] = useState(null);
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [workflowAuditTrail, setWorkflowAuditTrail] = useState([]);
  const [exportReceipts, setExportReceipts] = useState([]);

  useEffect(() => {
    if (isElectron) setView('editor');
    if (isElectron) setWorkspace('review');
  }, [setWorkspace]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setPdfjsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pushToast = useCallback((toast) => {
    setToasts(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, ...toast }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const appendWorkflowAction = useCallback((entry) => {
    setWorkflowAuditTrail((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        occurredAt: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ].slice(0, 6));
  }, []);

  const appendExportReceipt = useCallback((entry) => {
    setExportReceipts((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        occurredAt: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ].slice(0, 8));
  }, []);

  // When switching to editor, lock body scroll and reset scroll position
  useEffect(() => {
    if (view === 'editor') {
      window.scrollTo(0, 0);
      document.documentElement.classList.add('editor-active');
      document.body.classList.add('editor-active');
    } else {
      document.documentElement.classList.remove('editor-active');
      document.body.classList.remove('editor-active');
    }
  }, [view]);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [renderDoc, setRenderDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const renderDocRef = useRef(null);
  const editorStore = useEditorStore([]);
  const {
    objects,
    pages,
    pageMeta,
    selection,
    zoom,
    setZoom,
    activeTool,
    setActiveTool,
    interactionState,
    setInteractionState,
    setPageMeta,
    addObject,
    addObjects,
    updateObject,
    deleteObject,
    batchUpdateObjects,
    resetObjects,
    setSelection,
    commitHistory,
    undo,
    redo,
  } = editorStore;
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [watermarkText, setWatermarkText] = useState('');
  const [fileName, setFileName] = useState('document.pdf');
  const [loading, setLoading] = useState(false);
  const selectionIds = selection;
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [profile, setProfile] = useState(() => loadProfile());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [formProfileKey, setFormProfileKey] = useState(null);
  const activeFormProfile = useMemo(
    () => (formProfileKey ? FORM_PROFILES[formProfileKey] ?? null : null),
    [formProfileKey]
  );

  const [layers] = useState({
    base: { name: 'Base PDF', visible: true, locked: true },
    annotations: { name: 'Annotations', visible: true, locked: false },
    markup: { name: 'Markup', visible: true, locked: false },
    forms: { name: 'Form Fields', visible: true, locked: false },
  });

  const fileInputRef = useRef(null);
  const mergeInputRef = useRef(null);
  const insertFileRef = useRef(null);
  const imageInputRef = useRef(null);
  const imagesToPdfInputRef = useRef(null);
  const jsonInputRef = useRef(null);
  const wheelAccumulatorRef = useRef(0);
  const wheelResetTimeoutRef = useRef(null);
  const [insertPosition, setInsertPosition] = useState('after');
  const [imagePlacementQueue, setImagePlacementQueue] = useState([]);
  const [imagePlacement, setImagePlacement] = useState(null);
  const [toolDefaults, setToolDefaults] = useState({
    text: {
      fontSize: 16,
      color: '#000000',
      fontFamily: 'Helvetica',
    },
    highlight: {
      color: '#34d399',
      opacity: 0.35,
    },
    draw: {
      color: '#000000',
      lineWidth: 2,
    },
    redact: {
      color: '#000000',
    },
    edit: {
      color: '#ffffff',
      textColor: '#000000',
      fontSize: 16,
    },
  });

  useEffect(() => {
    const previousDoc = renderDocRef.current;
    renderDocRef.current = renderDoc;
    if (previousDoc && previousDoc !== renderDoc) {
      try {
        previousDoc.destroy?.();
      } catch (err) {
        console.warn('Failed to destroy previous PDF.js document:', err);
      }
    }
  }, [renderDoc]);

  useEffect(() => () => {
    if (renderDocRef.current) {
      try {
        renderDocRef.current.destroy?.();
      } catch (err) {
        console.warn('Failed to destroy PDF.js document during cleanup:', err);
      }
      renderDocRef.current = null;
    }
  }, []);

  const updateFromResult = useCallback((result, options = {}) => {
    const nextPageMeta = buildPageMetaFromDoc(
      result.pdfDoc,
      options.pageIds ?? pageMeta.map((meta) => meta.id)
    );
    setPdfDoc(result.pdfDoc);
    setPdfBytes(result.bytes);
    setRenderDoc(result.renderDoc);
    setNumPages(result.pdfDoc.getPageCount());
    setPageMeta(nextPageMeta);
    pushToast({
      type: 'info',
      title: 'Document Loaded',
      message: `${result.pdfDoc.getPageCount()} pages ready.`,
    });
    return nextPageMeta;
  }, [pageMeta, setPageMeta, pushToast]);

  // --- Load a PDF from ArrayBuffer + name ---
  const loadFromBuffer = useCallback(async (buffer, name) => {
    if (!pdfjsReady) return;
    setLoading(true);
    try {
      const result = await loadPdf(buffer);
      const nextPageMeta = updateFromResult(result, { pageIds: [] });
      setFileName(name);
      setCurrentPage(1);
      const formFields = attachPageIds(await Promise.all(
        Array.from({ length: result.pdfDoc.getPageCount() }, (_, i) =>
          detectFormFields(result.renderDoc, i + 1)
        )
      ).then(pages => pages.flat()), nextPageMeta);
      resetObjects(formFields);
      setSelection([]);
      const fieldNames = formFields.map(f => f.fieldName).filter(Boolean);
      setFormProfileKey(detectFormProfile(fieldNames));
      setActiveTool('select');
      setWorkspace('review');
    } catch (err) {
      alert('Failed to load PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfjsReady, updateFromResult, resetObjects, setSelection, setActiveTool, setWorkspace]);

  // --- Load a PDF from File object (browser drag-drop / input) ---
  const loadFile = useCallback(async (file) => {
    const buffer = await file.arrayBuffer();
    await loadFromBuffer(buffer, file.name);
  }, [loadFromBuffer]);

  // --- File operations ---
  const handleOpen = useCallback(async () => {
    if (!pdfjsReady) return;
    if (isElectron) {
      const fileInfo = await window.electronAPI.openFileDialog();
      if (!fileInfo) return;
      const bytes = Uint8Array.from(atob(fileInfo.data), c => c.charCodeAt(0));
      await loadFromBuffer(bytes.buffer, fileInfo.name);
    } else {
      fileInputRef.current?.click();
    }
  }, [pdfjsReady, loadFromBuffer]);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (file) await loadFile(file);
    e.target.value = '';
  }, [loadFile]);

  // Objects to embed at export time, with page assignment derived from page
  // OWNERSHIP via the engine document — not from a possibly-stale obj.page.
  const getExportObjects = useCallback(
    () => documentToEmbedObjects(toEngineDocument(pageMeta, objects)),
    [pageMeta, objects]
  );

  const handleSave = useCallback(async () => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      let bytes = pdfBytes;
      if (objects.length > 0) {
        bytes = await secureEmbed(bytes, getExportObjects(), layers, renderDoc, { flattenForm: true });
      }
      if (watermarkText) {
        bytes = await addWatermark(bytes, watermarkText);
      }
      if (isElectron) {
        const base64 = btoa(
          new Uint8Array(bytes).reduce((s, b) => s + String.fromCharCode(b), '')
        );
        await window.electronAPI.saveFileDialog(fileName, base64);
      } else {
        await saveWithDialog(bytes, fileName);
      }
      appendWorkflowAction({
        label: `Saved ${fileName}`,
        detail: `${fileName} was updated with the current review changes.`,
      });
      appendExportReceipt({
        label: `PDF save completed`,
        detail: `${fileName} was saved with current annotations and production edits.`,
      });
      pushToast({
        type: 'success',
        title: 'PDF Saved',
        message: `${fileName} was updated with the current review changes.`,
      });
    } catch (err) {
      alert('Failed to save PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [appendExportReceipt, appendWorkflowAction, pdfBytes, objects, getExportObjects, fileName, watermarkText, layers, renderDoc, pushToast]);

  const handleSaveAs = useCallback(async () => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      let bytes = pdfBytes;
      if (objects.length > 0) {
        bytes = await secureEmbed(bytes, getExportObjects(), layers, renderDoc, { flattenForm: true });
      }
      if (watermarkText) {
        bytes = await addWatermark(bytes, watermarkText);
      }
      if (isElectron) {
        const base64 = btoa(
          new Uint8Array(bytes).reduce((s, b) => s + String.fromCharCode(b), '')
        );
        await window.electronAPI.saveFileDialog(fileName, base64);
      } else {
        await saveWithDialog(bytes, fileName);
      }
      appendWorkflowAction({
        label: `Saved a new copy of ${fileName}`,
        detail: `A new production copy of ${fileName} is ready.`,
      });
      appendExportReceipt({
        label: `Production copy created`,
        detail: `A new saved copy of ${fileName} was prepared for delivery.`,
      });
      pushToast({
        type: 'success',
        title: 'Save As Complete',
        message: `A new production copy of ${fileName} is ready.`,
      });
    } catch (err) {
      alert('Failed to save PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [appendExportReceipt, appendWorkflowAction, pdfBytes, objects, getExportObjects, fileName, watermarkText, layers, renderDoc, pushToast]);

  const handleMerge = useCallback(() => {
    mergeInputRef.current?.click();
  }, []);

  const handleMergeFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pdfDoc) return;
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await mergePdf(pdfDoc, buffer);
      updateFromResult(result);
    } catch (err) {
      alert('Failed to merge PDF: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }, [pdfDoc, updateFromResult]);

  // --- Page operations ---
  const handleAddBlank = useCallback(() => {
    if (!pdfDoc) return;
    setShowInsertDialog(true);
  }, [pdfDoc]);

  const handleInsertPage = useCallback(async (position) => {
    if (!pdfDoc) return;
    setShowInsertDialog(false);
    setLoading(true);
    try {
      // position: 'before' = insert before currentPage, 'after' = insert after currentPage
      const atIndex = position === 'before' ? currentPage - 1 : currentPage;
      const result = await addBlankPage(pdfDoc, atIndex);
      const nextPageIds = pageMeta.map((meta) => meta.id);
      nextPageIds.splice(atIndex, 0, nextPageMetaId());
      updateFromResult(result, { pageIds: nextPageIds });
      setCurrentPage(atIndex + 1);
    } catch (err) {
      alert('Failed to insert page: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, currentPage, pageMeta, updateFromResult]);

  const handleInsertFromPdf = useCallback((position) => {
    setInsertPosition(position);
    setShowInsertDialog(false);
    insertFileRef.current?.click();
  }, []);

  const handleInsertPdfPages = useCallback(() => {
    if (!pdfDoc) return;
    setShowInsertDialog(true);
  }, [pdfDoc]);

  const handleInsertFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pdfDoc) return;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const atIndex = insertPosition === 'before' ? currentPage - 1 : currentPage;
      const result = await insertPdf(pdfDoc, buf, atIndex);
      const insertedCount = result.pdfDoc.getPageCount() - pageMeta.length;
      const nextPageIds = pageMeta.map((meta) => meta.id);
      const insertedIds = Array.from({ length: insertedCount }, () => nextPageMetaId());
      nextPageIds.splice(atIndex, 0, ...insertedIds);
      updateFromResult(result, { pageIds: nextPageIds });
      setCurrentPage(atIndex + 1);
    } catch (err) {
      alert('Failed to insert PDF: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }, [pdfDoc, currentPage, insertPosition, pageMeta, updateFromResult]);

  const handleDeletePageAt = useCallback(async (pageNumber) => {
    if (!pdfDoc || numPages <= 1) return;
    if (!confirm(`Delete page ${pageNumber}?`)) return;
    setLoading(true);
    try {
      const removedPageMeta = pageMeta[pageNumber - 1];
      const result = await deletePage(pdfDoc, pageNumber - 1);
      const nextPageIds = pageMeta
        .filter((_, index) => index !== pageNumber - 1)
        .map((meta) => meta.id);
      updateFromResult(result, { pageIds: nextPageIds });
      setCurrentPage(prev => {
        if (prev > result.pdfDoc.getPageCount()) return result.pdfDoc.getPageCount();
        if (prev === pageNumber) return Math.min(pageNumber, result.pdfDoc.getPageCount());
        return prev > pageNumber ? prev - 1 : prev;
      });
      // Drop annotations that belonged to the deleted page. No page-number
      // resync needed: render and export both derive position from pageId
      // ownership, and updateFromResult already re-mapped the page ids.
      commitHistory(prev =>
        prev.filter((annotation) => {
          if (removedPageMeta?.id && annotation.pageId) return annotation.pageId !== removedPageMeta.id;
          return annotation.page !== pageNumber;
        })
      );
    } catch (err) {
      alert('Failed to delete page: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, numPages, pageMeta, updateFromResult, commitHistory]);

  const handleDeletePage = useCallback(async () => {
    await handleDeletePageAt(currentPage);
  }, [handleDeletePageAt, currentPage]);

  const handleRotate = useCallback(async (angle) => {
    if (!pdfDoc) return;
    setLoading(true);
    try {
      const result = await rotatePage(pdfDoc, currentPage - 1, angle);
      updateFromResult(result);
    } catch (err) {
      alert('Failed to rotate page: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, currentPage, updateFromResult]);

  const handleReorder = useCallback(async (fromIndex, toIndex) => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      const order = Array.from({ length: numPages }, (_, i) => i);
      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      const result = await reorderPages(pdfBytes, order);
      const nextPageIds = order.map((pageIndex) => pageMeta[pageIndex]?.id).filter(Boolean);
      updateFromResult(result, { pageIds: nextPageIds });
      setCurrentPage(toIndex + 1);
    } catch (err) {
      alert('Failed to reorder pages: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, numPages, pageMeta, updateFromResult]);

  // --- Watermark ---
  const handleWatermark = useCallback(() => {
    if (watermarkText) {
      if (confirm('Remove watermark?')) {
        setWatermarkText('');
      }
      return;
    }
    const text = prompt('Watermark text:', 'CONFIDENTIAL');
    if (text) setWatermarkText(text);
  }, [watermarkText]);

  // --- Split ---
  const handleSplit = useCallback(async () => {
    if (!pdfBytes || numPages <= 1) return;
    const range = prompt(`Extract pages (e.g. "1-3" from ${numPages} pages):`, `1-${numPages}`);
    if (!range) return;
    const match = range.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) { alert('Invalid range. Use format: 1-3'); return; }
    const from = parseInt(match[1], 10);
    const to = parseInt(match[2], 10);
    if (from < 1 || to > numPages || from > to) { alert('Range out of bounds.'); return; }
    setLoading(true);
    try {
      const bytes = await splitPdf(pdfBytes, from, to);
      downloadBlob(bytes, fileName.replace(/\.pdf$/i, `_pages${from}-${to}.pdf`));
    } catch (err) {
      alert('Failed to split PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, numPages, fileName]);

  // --- Print ---
  const handlePrint = useCallback(async () => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      let bytes = pdfBytes;
      if (objects.length > 0) {
        bytes = await secureEmbed(bytes, getExportObjects(), layers, renderDoc, { flattenForm: true });
      }
      if (watermarkText) {
        bytes = await addWatermark(bytes, watermarkText);
      }
      printPdf(bytes);
      appendWorkflowAction({
        label: 'Prepared print output',
        detail: 'The current production PDF was prepared for printing.',
      });
      appendExportReceipt({
        label: 'Print job prepared',
        detail: 'A production-ready PDF was generated for printing.',
      });
      pushToast({
        type: 'success',
        title: 'Print Ready',
        message: 'The production PDF was prepared for printing.',
      });
    } finally {
      setLoading(false);
    }
  }, [appendExportReceipt, appendWorkflowAction, pdfBytes, objects, getExportObjects, watermarkText, layers, renderDoc, pushToast]);

  // --- Export ---
  const handleExportWord = useCallback(async () => {
    if (!renderDoc) return;
    setLoading(true);
    try {
      await convertPdfToWord(renderDoc, fileName.replace(/\.pdf$/i, '.docx'));
      appendWorkflowAction({
        label: `Exported ${fileName.replace(/\.pdf$/i, '.docx')}`,
        detail: `${fileName.replace(/\.pdf$/i, '.docx')} was generated from the current PDF.`,
      });
      appendExportReceipt({
        label: 'Word export generated',
        detail: `${fileName.replace(/\.pdf$/i, '.docx')} is ready for downstream editing or filing.`,
      });
      pushToast({
        type: 'success',
        title: 'Word Export Ready',
        message: `${fileName.replace(/\.pdf$/i, '.docx')} was generated from the current PDF.`,
      });
    } catch (err) {
      alert('Failed to export to Word: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [appendExportReceipt, appendWorkflowAction, renderDoc, fileName, pushToast]);

  

  const handleProfileSave = useCallback((nextProfile) => {
    const normalized = saveProfile(nextProfile);
    setProfile(normalized);
    setShowProfileModal(false);
  }, []);
  const selectedSet = useMemo(() => new Set(selectionIds), [selectionIds]);
const selectedObjects = useMemo(
() => objects.filter(o => selectedSet.has(o.id)),
[objects, selectedSet]
);
const currentPageMeta = useMemo(
() => pages[currentPage - 1] || null,
[pages, currentPage]
);
const currentPageObjects = useMemo(
() => currentPageMeta?.objects || [],
 [currentPageMeta]
);
const runDD214Analysis = useCallback(async () => {
    if (!renderDoc) return;
    setLoading(true);
    try {
      const result = await parseDD214(renderDoc, 1);
      const fields = result.fields || {};
      const summary = [
        `Name: ${fields.fullName || 'N/A'}`,
        `Branch: ${fields.branch || 'N/A'}`,
        `Rank: ${fields.rank || 'N/A'}`,
        `Entry: ${fields.entryDate || 'N/A'}`,
        `Separation: ${fields.separationDate || 'N/A'}`,
        `SSN: ${fields.ssn ? 'Detected' : 'N/A'}`,
        `Confidence: ${(result.confidence * 100).toFixed(0)}%`,
      ].join('\n');
      if (confirm(`DD214 Analysis\n\n${summary}\n\nSave to profile?`)) {
        const nextProfile = normalizeProfile({
          ...profile,
          member: {
            ...profile.member,
            fullName: fields.fullName || profile.member.fullName,
            branch: fields.branch || profile.member.branch,
            rank: fields.rank || profile.member.rank,
            ssn: fields.ssn || profile.member.ssn,
          },
          service: {
            ...profile.service,
            entryDate: fields.entryDate || profile.service.entryDate,
            separationDate: fields.separationDate || profile.service.separationDate,
          },
        });
        handleProfileSave(nextProfile);
      } else {
        alert(`DD214 Analysis\n\n${summary}`);
      }
    } catch (err) {
      alert('Failed to analyze DD214: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [renderDoc, profile, handleProfileSave]);

  // --- EditorObject scene graph CRUD (also handles legacy annotations) ---
  // Stamp every object with the pageId of its OWN page (by page number), falling
  // back to the current page. Full pageId coverage is what lets page ownership be
  // authoritative and the manual obj.page resync go away.
  const ensurePageId = useCallback((obj) => {
    if (obj.pageId) return obj;
    const ownPageId = pageMeta.find((meta) => meta.number === obj.page)?.id;
    const pageId = ownPageId ?? currentPageMeta?.id;
    return pageId ? { ...obj, pageId } : obj;
  }, [pageMeta, currentPageMeta]);

  const handleAddObject = useCallback((obj) => {
    const nextObject = ensurePageId(obj);
    addObject(nextObject);
    pushToast({ type: 'info', title: 'Annotation Added', message: nextObject?.type || 'Annotation' });
    if (nextObject?.type === 'evidenceMarker') {
      pushToast({ type: 'success', title: 'Evidence Marker', message: nextObject?.label || 'Evidence marker created.' });
      if (nextObject.timestamp) pushToast({ type: 'info', title: 'Timeline Updated' });
    }
  }, [addObject, ensurePageId, pushToast]);

  const handleAddObjects = useCallback((newObjects) => {
    const normalizedObjects = newObjects.map(ensurePageId);
    addObjects(normalizedObjects);
    normalizedObjects.forEach(obj => {
      pushToast({ type: 'info', title: 'Annotation Added', message: obj?.type || 'Annotation' });
      if (obj?.type === 'evidenceMarker') {
        pushToast({ type: 'success', title: 'Evidence Marker', message: obj?.label || 'Evidence marker created.' });
        if (obj.timestamp) pushToast({ type: 'info', title: 'Timeline Updated' });
      }
    });
  }, [addObjects, ensurePageId, pushToast]);

  const runAutoRedact = useCallback(async () => {
    if (!renderDoc) return;
    setLoading(true);
    try {
      const findings = await scanForPii(renderDoc);
      if (findings.length === 0) {
        alert('No PII found.');
        return;
      }
      if (confirm(`Found ${findings.length} possible PII items. Apply redactions?`)) {
        handleAddObjects(findings);
      }
    } catch (err) {
      alert('Failed to scan for PII: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [renderDoc, handleAddObjects]);

  // --- Image placement ---
  const handleImportImages = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleCreatePdfFromImages = useCallback(() => {
    imagesToPdfInputRef.current?.click();
  }, []);

  const readImageFile = useCallback(async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const bitmap = await createImageBitmap(file);
    const placement = {
      name: file.name,
      dataUrl,
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close?.();
    return placement;
  }, []);

  const queueImagePlacements = useCallback(async (files) => {
    if (files.length === 0) return;
    const placements = [];
    for (const file of files) {
      try {
        placements.push(await readImageFile(file));
      } catch (err) {
        console.warn('Failed to load image:', file.name, err);
      }
    }
    if (placements.length === 0) return;
    setImagePlacementQueue(placements);
    setActiveTool('image');
  }, [readImageFile, setActiveTool]);

  const handleImageFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    await queueImagePlacements(files);
    if (e.target) e.target.value = '';
  }, [queueImagePlacements]);

  const handleImagesToPdfFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    try {
      const result = await imagesToPdf(files);
      updateFromResult(result, { pageIds: [] });
      resetObjects([]);
      setSelection([]);
      setFormProfileKey(null);
      setWatermarkText('');
      setFileName(files.length === 1
        ? files[0].name.replace(/\.[^.]+$/u, '.pdf')
        : 'image-bundle.pdf');
      setCurrentPage(1);
      setActiveTool('select');
      setWorkspace('review');
      pushToast({
        type: 'success',
        title: 'PDF Created',
        message: `${files.length} image${files.length === 1 ? '' : 's'} converted into a new PDF.`,
      });
    } catch (err) {
      alert('Failed to create PDF from images: ' + err.message);
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  }, [pushToast, resetObjects, setActiveTool, setSelection, setWorkspace, updateFromResult]);

  // --- Listen for files opened via OS file association (Electron) ---
  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.onOpenFile(async (fileInfo) => {
      const bytes = Uint8Array.from(atob(fileInfo.data), c => c.charCodeAt(0));
      await loadFromBuffer(bytes.buffer, fileInfo.name);
    });
    window.electronAPI.onOpenImages(async (images) => {
      const files = images.map(img => {
        const binary = atob(img.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const ext = img.name.split('.').pop().toLowerCase();
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', bmp: 'image/bmp', gif: 'image/gif', webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff' };
        return new File([bytes], img.name, { type: mimeMap[ext] || 'image/png' });
      });
      files.sort((a, b) => a.name.localeCompare(b.name));
      await queueImagePlacements(files);
      setView('editor');
      setWorkspace('review');
    });
  }, [loadFromBuffer, queueImagePlacements, setView, setWorkspace]);

  useEffect(() => {
    setImagePlacement(imagePlacementQueue[0] || null);
    if (imagePlacementQueue.length === 0 && activeTool === 'image') {
      setActiveTool('select');
    }
  }, [imagePlacementQueue, activeTool, setActiveTool]);

  const handleImagePlaced = useCallback(() => {
    setImagePlacementQueue(prev => prev.slice(1));
  }, []);

  const handleImagePlacementCancel = useCallback(() => {
    setImagePlacementQueue([]);
  }, []);

  const handleDeleteObject = useCallback((id) => {
    const obj = objects.find(item => item.id === id);
    if (!obj) return;
    if (obj.locked) return;
    if (layers?.[obj.layerId]?.locked) return;
    deleteObject(id);
  }, [objects, layers, deleteObject]);

  const handleUpdateObject = useCallback((id, updates) => {
    updateObject(id, updates);
    if (updates?.timestamp) pushToast({ type: 'info', title: 'Timeline Updated' });
  }, [updateObject, pushToast]);

  const handleBatchUpdateObjects = useCallback((patches) => {
    batchUpdateObjects(patches);
  }, [batchUpdateObjects]);

  const handleToggleVisible = useCallback((id) => {
    const obj = objects.find(item => item.id === id);
    if (!obj) return;
    updateObject(id, { visible: obj.visible === false });
  }, [objects, updateObject]);

  const handleToggleLocked = useCallback((id) => {
    const obj = objects.find(item => item.id === id);
    if (!obj) return;
    updateObject(id, { locked: !obj.locked });
  }, [objects, updateObject]);

  const handleLayerReorder = useCallback((orderedIds) => {
    if (!orderedIds || orderedIds.length === 0) return;
    const maxIndex = orderedIds.length - 1;
    const patches = orderedIds.map((id, index) => ({
      id,
      zIndex: maxIndex - index,
    }));
    batchUpdateObjects(patches);
  }, [batchUpdateObjects]);

  const evidenceIndex = useMemo(() => buildEvidenceIndex(objects), [objects]);
  const caseGraph = useMemo(() => buildCaseGraph({
    evidenceIndex,
    pages,
  }), [evidenceIndex, pages]);

  const handleAskAva = useCallback(async (question) => {
    const context = await buildCaseContext({
      renderDoc,
      evidenceIndex,
      caseGraph,
    });
    return askAva(question, context);
  }, [renderDoc, evidenceIndex, caseGraph]);

  const appendAssistantRun = useCallback((entry) => {
    setAssistantRunHistory((prev) => [
      { id: nextPhase3Id('assistant-run'), ...entry },
      ...prev,
    ].slice(0, 8));
  }, []);

  const proposedFindings = useMemo(
    () => findings.filter((item) => item.status === 'proposed'),
    [findings]
  );
  const acceptedFindings = useMemo(
    () => findings.filter((item) => item.status === 'accepted'),
    [findings]
  );
  const selectedFinding = useMemo(
    () => findings.find((item) => item.id === selectedFindingId) || null,
    [findings, selectedFindingId]
  );
  const lastWorkflowAction = workflowAuditTrail[0] || null;

  const handleAcceptFinding = useCallback((findingId) => {
    const finding = findings.find((item) => item.id === findingId);
    if (!finding) return;
    const previousStatus = finding.status;
    acceptFinding(findingId);
    appendWorkflowAction({
      label: `Approved ${finding.title}`,
      detail: `${finding.title} moved into the approved review set.`,
      undoLabel: 'Undo approval',
      onUndo: () => updateFinding(findingId, { status: previousStatus }),
    });
    pushToast({
      type: 'success',
      title: 'Review Item Approved',
      message: `${finding.title} is approved and ready for the next workflow step.`,
      actionLabel: 'Undo',
      onAction: () => updateFinding(findingId, { status: previousStatus }),
    });
  }, [acceptFinding, appendWorkflowAction, findings, pushToast, updateFinding]);

  const handleRejectFinding = useCallback((findingId) => {
    const finding = findings.find((item) => item.id === findingId);
    if (!finding) return;
    const previousStatus = finding.status;
    rejectFinding(findingId);
    appendWorkflowAction({
      label: `Excluded ${finding.title}`,
      detail: `${finding.title} was removed from the production set.`,
      undoLabel: 'Undo exclusion',
      onUndo: () => updateFinding(findingId, { status: previousStatus }),
    });
    pushToast({
      type: 'info',
      title: 'Review Item Excluded',
      message: `${finding.title} was excluded from the production set.`,
      actionLabel: 'Undo',
      onAction: () => updateFinding(findingId, { status: previousStatus }),
    });
  }, [appendWorkflowAction, findings, pushToast, rejectFinding, updateFinding]);

  const promoteFindingToEvidence = useCallback((findingId) => {
    const finding = findings.find((item) => item.id === findingId);
    if (!finding) return;
    const previousStatus = finding.status;
    const evidenceItem = {
      id: nextPhase3Id('evidence'),
      sourceFindingId: findingId,
      title: finding.title,
      summary: finding.summary,
      page: finding.page,
      type: finding.type,
    };

    handleAcceptFinding(findingId);
    setEvidenceItems((prev) => {
      if (prev.some((item) => item.sourceFindingId === findingId)) return prev;
      return [evidenceItem, ...prev];
    });
    appendWorkflowAction({
      label: `Promoted ${finding.title} to evidence`,
      detail: `${finding.title} is now linked into the packet evidence set.`,
      undoLabel: 'Undo promotion',
      onUndo: () => {
        updateFinding(findingId, { status: previousStatus });
        setEvidenceItems((prev) => prev.filter((item) => item.sourceFindingId !== findingId));
      },
    });
    pushToast({
      type: 'success',
      title: 'Evidence Added',
      message: `${finding.title} is ready for packet prep.`,
      actionLabel: 'Undo',
      onAction: () => {
        updateFinding(findingId, { status: previousStatus });
        setEvidenceItems((prev) => prev.filter((item) => item.sourceFindingId !== findingId));
      },
    });
  }, [appendWorkflowAction, findings, handleAcceptFinding, pushToast, updateFinding]);

  const runAssistantAction = useCallback(async (action) => {
    if (!action || (action.disabled && !renderDoc)) return;

    setLoading(true);
    try {
      if (action.id === 'find_pii') {
        const piiMatches = await scanForPii(renderDoc);
        const piiFindings = piiMatches.map((match) => ({
          id: nextPhase3Id('finding'),
          type: 'pii',
          typeLabel: match._piiLabel || 'Sensitive Information',
          title: `${match._piiLabel || 'Sensitive information'} detected`,
          summary: `${match._piiText || 'Sensitive data'} on page ${match.page}.`,
          detail: `Review the highlighted value before applying a redaction. Candidate: ${match._piiText || 'n/a'}`,
          page: match.page,
          status: 'proposed',
          createdBy: 'assistant',
          metadata: {
            piiType: match._piiType,
            piiText: match._piiText,
          },
        }));

        if (piiFindings.length === 0) {
          appendAssistantRun({ label: action.label, outcome: 'No likely PII found.' });
          pushToast({ type: 'info', title: 'PII Scan Complete', message: 'No likely PII found.' });
          return;
        }

        addFindings(piiFindings);
        setSelectedFindingId(piiFindings[0]?.id || null);
        setWorkspace('findings');
        appendAssistantRun({ label: action.label, outcome: `${piiFindings.length} findings created.` });
        pushToast({
          type: 'success',
          title: 'PII Findings Ready',
          message: `${piiFindings.length} sensitive-data findings are ready for review.`,
        });
        return;
      }

      const result = await handleAskAva(action.prompt);
      const answer = result?.answer || result?.content || 'No response generated.';
      const finding = {
        id: nextPhase3Id('finding'),
        type: action.id === 'extract_dates' ? 'timeline' : action.id === 'draft_exhibit_note' ? 'exhibit_note' : 'summary',
        typeLabel: action.id === 'extract_dates' ? 'Date Review' : action.id === 'draft_exhibit_note' ? 'Exhibit Draft' : 'Page Summary',
        title: action.label,
        summary: answer.split('\n')[0] || action.description,
        detail: answer,
        page: currentPage,
        status: 'proposed',
        createdBy: 'assistant',
      };

      if (action.id === 'draft_exhibit_note') {
        setEvidenceItems((prev) => [
          {
            id: nextPhase3Id('evidence'),
            sourceFindingId: finding.id,
            title: `Exhibit Draft Ãƒâ€šÃ‚Â· Page ${currentPage}`,
            summary: finding.summary,
            page: currentPage,
            type: 'exhibit_note',
          },
          ...prev,
        ]);
      }

      addFindings([finding]);
      setSelectedFindingId(finding.id);
      setWorkspace(action.id === 'draft_exhibit_note' ? 'evidence' : 'findings');
      appendAssistantRun({ label: action.label, outcome: 'Review-ready output created.' });
      pushToast({
        type: 'success',
        title: 'Assistant Output Ready',
        message: `${action.label} created a review-ready item.`,
      });
    } catch (err) {
      appendAssistantRun({ label: action.label, outcome: 'Action failed.' });
      pushToast({
        type: 'info',
        title: 'Assistant Action Failed',
        message: err.message,
      });
    } finally {
      setAssistantActionProposal(null);
      setLoading(false);
    }
  }, [
    addFindings,
    appendAssistantRun,
    currentPage,
    handleAskAva,
    pushToast,
    renderDoc,
    setSelectedFindingId,
    setWorkspace,
  ]);

  useEffect(() => {
    setSelection(prev => prev.filter(id => objects.some(o => o.id === id)));
  }, [objects, setSelection]);

  const handleCopy = useCallback(() => {
    copyObjects(objects, selectedSet);
  }, [objects, selectedSet]);

  const handlePaste = useCallback(() => {
    const pasted = pasteObjects(currentPage).map((obj) => ({
      ...obj,
      page: currentPage,
      pageId: currentPageMeta?.id || obj.pageId,
    }));
    handleAddObjects(pasted);
    setSelection(pasted.map(o => o.id));
  }, [currentPage, currentPageMeta, handleAddObjects, setSelection]);

  const handleDuplicate = useCallback(() => {
    const duplicated = duplicateObjects(objects, selectedSet);
    handleAddObjects(duplicated);
    setSelection(duplicated.map(o => o.id));
  }, [objects, selectedSet, handleAddObjects, setSelection]);

  const handleAutoFill = useCallback(() => {
    if (!activeFormProfile) return;
    const filled = autofillScene(objects, profile, activeFormProfile);
    commitHistory(filled);
  }, [activeFormProfile, commitHistory, objects, profile]);

  const handleAlignment = useCallback((type) => {
    if (selectedSet.size < 2) return;
    let patches = [];
    if (type === 'left') patches = alignLeft(objects, selectedSet);
    else if (type === 'right') patches = alignRight(objects, selectedSet);
    else if (type === 'top') patches = alignTop(objects, selectedSet);
    else if (type === 'bottom') patches = alignBottom(objects, selectedSet);
    else if (type === 'centerH') patches = alignCenterH(objects, selectedSet);
    else if (type === 'centerV') patches = alignCenterV(objects, selectedSet);
    else if (type === 'distributeH') patches = distributeHorizontally(objects, selectedSet);
    else if (type === 'distributeV') patches = distributeVertically(objects, selectedSet);
    handleBatchUpdateObjects(patches);
  }, [objects, selectedSet, handleBatchUpdateObjects]);

  const handleZOrder = useCallback((type) => {
    if (selectionIds.length === 0) return;
    const id = selectionIds[0];
    let patches = [];
    if (type === 'forward') patches = bringForward(objects, id);
    else if (type === 'backward') patches = sendBackward(objects, id);
    else if (type === 'front') patches = bringToFront(objects, id);
    else if (type === 'back') patches = sendToBack(objects, id);
    handleBatchUpdateObjects(patches);
  }, [objects, selectionIds, handleBatchUpdateObjects]);

  const handleToolChange = useCallback((tool) => {
    if (tool === 'signature' && !signatureDataUrl) {
      setShowSignaturePad(true);
      return;
    }
    setActiveTool(tool);
  }, [signatureDataUrl, setActiveTool]);

  const setCurrentPageAndScroll = useCallback((page) => {
    const clampedPage = Math.min(Math.max(page, 1), Math.max(numPages, 1));
    setCurrentPage(clampedPage);
    wheelAccumulatorRef.current = 0;
  }, [numPages]);

  const handleViewerWheel = useCallback((e) => {
    if (!renderDoc || numPages <= 1) return;
    wheelAccumulatorRef.current += e.deltaY;
    const threshold = 120;

    if (wheelAccumulatorRef.current >= threshold && currentPage < numPages) {
      e.preventDefault();
      wheelAccumulatorRef.current = 0;
      setCurrentPage(currentPage + 1);
      return;
    }

    if (wheelAccumulatorRef.current <= -threshold && currentPage > 1) {
      e.preventDefault();
      wheelAccumulatorRef.current = 0;
      setCurrentPage(currentPage - 1);
      return;
    }

    window.clearTimeout(wheelResetTimeoutRef.current);
    wheelResetTimeoutRef.current = window.setTimeout(() => {
      wheelAccumulatorRef.current = 0;
    }, 180);
  }, [currentPage, numPages, renderDoc]);

  useEffect(() => () => {
    window.clearTimeout(wheelResetTimeoutRef.current);
  }, []);

  const handleToolDefaultChange = useCallback((tool, key, value) => {
    setToolDefaults(prev => ({
      ...prev,
      [tool]: {
        ...prev[tool],
        [key]: value,
      },
    }));
  }, []);

  const handleExportJson = useCallback(() => {
    if (!renderDoc) return;
    triggerJsonDownload({
      version: 1,
      fileName,
      exportedAt: new Date().toISOString(),
      annotationCount: objects.length,
      annotations: objects,
    }, fileName.replace(/\.pdf$/i, '_annotations.json'));
  }, [renderDoc, fileName, objects]);

  const handleImportJson = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const imported = Array.isArray(parsed) ? parsed : parsed.annotations;
      if (!Array.isArray(imported)) {
        throw new Error('Invalid annotation JSON.');
      }
      if (objects.length > 0 && !confirm('Replace current annotations with the imported JSON?')) {
        return;
      }
      const normalizedImported = attachPageIds(imported, pages);
      resetObjects(normalizedImported);
      setSelection([]);
      const nextPage = normalizedImported.reduce((max, item) => {
        if (item.pageId) {
          const pageIndex = pages.findIndex((page) => page.id === item.pageId);
          return Math.max(max, pageIndex >= 0 ? pageIndex + 1 : 1);
        }
        return Math.max(max, item.page || 1);
      }, 1);
      setCurrentPage(Math.min(numPages || 1, nextPage));
    } catch (err) {
      alert('Failed to import JSON: ' + err.message);
    } finally {
      e.target.value = '';
    }
  }, [objects.length, pages, resetObjects, setSelection, numPages]);

  const activeToolConfig = useMemo(() => {
    if (activeTool === 'highlight') {
      return {
        key: 'highlight',
        title: 'Highlight',
        fields: [
          { key: 'color', label: 'Color', type: 'color' },
          { key: 'opacity', label: 'Opacity', type: 'range', min: 0.1, max: 0.8, step: 0.05 },
        ],
      };
    }
    if (activeTool === 'draw') {
      return {
        key: 'draw',
        title: 'Draw',
        fields: [
          { key: 'color', label: 'Ink', type: 'color' },
          { key: 'lineWidth', label: 'Stroke', type: 'range', min: 1, max: 8, step: 1 },
        ],
      };
    }
    if (activeTool === 'text') {
      return {
        key: 'text',
        title: 'Text',
        fields: [
          { key: 'color', label: 'Color', type: 'color' },
          { key: 'fontSize', label: 'Size', type: 'range', min: 10, max: 48, step: 1 },
        ],
      };
    }
    if (activeTool === 'edit') {
      return {
        key: 'edit',
        title: 'Eraser',
        fields: [
          { key: 'color', label: 'Fill', type: 'color' },
          { key: 'fontSize', label: 'Text Size', type: 'range', min: 10, max: 36, step: 1 },
        ],
      };
    }
    if (activeTool === 'redact') {
      return {
        key: 'redact',
        title: 'Redaction',
        fields: [
          { key: 'color', label: 'Fill', type: 'color' },
        ],
      };
    }
    return {
      key: 'select',
      title: getActiveToolLabel(activeTool),
      fields: [],
    };
  }, [activeTool]);

  const pageAnnotations = useMemo(
    () => currentPageObjects.filter(obj => obj.type !== 'formField'),
    [currentPageObjects]
  );

  const commandContext = useMemo(() => ({
    hasDoc: !!renderDoc,
    setActiveTool,
    handleToolChange,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleMerge,
    handleSplit,
    handleRotate,
    handleAddBlank,
    handleDeletePage,
    handlePrint,
    handleExportWord,
    handleWatermark,
    handleImportImages,
    handleCreatePdfFromImages,
    handleInsertPdfPages,
    setShowSignaturePad,
    signatureDataUrl,
    setZoom,
    setCurrentPage,
    numPages,
    toggleCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    setActiveWorkflow,
    runDD214Analysis,
    runAutoRedact,
    applyAlignment: handleAlignment,
    applyZOrder: handleZOrder,
    handleCopy,
    handlePaste,
    handleDuplicate,
    undo,
    redo,
    openProfile: () => setShowProfileModal(true),
    autoFillProfile: handleAutoFill,
  }), [renderDoc, setActiveTool, handleToolChange, handleOpen, handleSave, handleSaveAs, handleMerge, handleSplit, handleRotate,
    handleAddBlank, handleDeletePage, handlePrint, handleExportWord, handleWatermark, handleImportImages,
    handleCreatePdfFromImages, handleInsertPdfPages, signatureDataUrl, setZoom, setCurrentPage, numPages,
    setActiveWorkflow, runDD214Analysis, runAutoRedact, handleAlignment, handleZOrder, handleCopy,
    handlePaste, handleDuplicate, undo, redo, handleAutoFill, setShowProfileModal,
    setCommandPaletteOpen]);

  const commands = useMemo(() => buildCommandRegistry(commandContext), [commandContext]);

  const runCommand = useCallback((id) => {
    const cmd = commands.find((c) => c.id === id);
    cmd?.execute(commandContext);
  }, [commands, commandContext]);

  const shortcutMap = useMemo(() => buildShortcutMap(commands), [commands]);

  // --- Signature ---
  const handleSignatureSave = useCallback((dataUrl) => {
    setSignatureDataUrl(dataUrl);
    setShowSignaturePad(false);
    setActiveTool('signature');
  }, [setActiveTool]);

  // --- Crop ---
  const handleCropApply = useCallback(async (cropBox) => {
    if (!pdfDoc) return;
    setLoading(true);
    try {
      const result = await cropPage(pdfDoc, currentPage - 1, cropBox);
      updateFromResult(result);
      setActiveTool('select');
    } catch (err) {
      alert('Failed to crop: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, currentPage, updateFromResult, setActiveTool]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e) => {
      const inInput = !!e.target.closest('input,textarea,select');
      if (!inInput) {
        // Ctrl+Shift+Z -> redo (Mac/Linux convention alongside Ctrl+Y)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          redo();
          return;
        }
        const key = eventToShortcut(e);
        const cmdId = key ? shortcutMap.get(key) : null;
        if (cmdId) {
          e.preventDefault();
          runCommand(cmdId);
          return;
        }
      }

      if (e.key === 'ArrowLeft' && !inInput && selectionIds.length === 0) {
        setCurrentPage(p => {
          return Math.max(1, p - 1);
        });
      }
      else if (e.key === 'ArrowRight' && !inInput && selectionIds.length === 0) {
        setCurrentPage(p => {
          return Math.min(numPages, p + 1);
        });
      }
      else if (e.key === 'Delete' && !inInput && renderDoc) { handleDeletePage(); }

      if (!inInput && activeTool === 'select' && selectionIds.length > 0 &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const nudge = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0;
        const dy = e.key === 'ArrowUp' ? nudge : e.key === 'ArrowDown' ? -nudge : 0;
        const patches = selectedObjects.map(obj => ({
          id: obj.id,
          pdfX: obj.pdfX + dx,
          pdfY: obj.pdfY + dy,
        }));
        handleBatchUpdateObjects(patches);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [renderDoc, activeTool, selectionIds, selectedObjects, numPages, handleDeletePage,
    handleBatchUpdateObjects, runCommand, shortcutMap, redo]);

  const assistantSuggestedActions = useMemo(
    () => buildAssistantActionCatalog({ currentPage, hasDocument: !!renderDoc }),
    [currentPage, renderDoc]
  );

  const handleSuggestedAssistantAction = useCallback((actionId) => {
    const action = assistantSuggestedActions.find((item) => item.id === actionId)
      || assistantSuggestedActions.find((item) => item.label === actionId);
    if (!action) return actionId;

    setAssistantActionProposal(action);
    setReviewPanelTab('assistant');
    pushToast({
      type: 'info',
      title: 'Assistant Action Ready',
      message: `${action.label} is ready for review and approval.`,
    });
    return action.prompt;
  }, [assistantSuggestedActions, pushToast, setReviewPanelTab]);

  const workspaceLabel = useMemo(() => (
    WORKSPACE_ITEMS.find((item) => item.id === workspace)?.label || 'Review'
  ), [workspace]);

  const matterName = activeFormProfile?.name || 'Current Matter';
  const findingsCount = pageAnnotations.length + evidenceIndex.markers.length + findings.filter((finding) => finding.status !== 'rejected').length;
  const unsavedChanges = objects.length > 0;
  const productionBlockers = useMemo(() => {
    const blockers = [];

    if (!renderDoc) {
      blockers.push({
        id: 'load-document',
        label: 'Load a document before continuing to production export.',
        actionLabel: 'Open PDF',
        onAction: handleOpen,
        disabled: !pdfjsReady,
      });
    }

    if (proposedFindings.length > 0) {
      blockers.push({
        id: 'resolve-review-items',
        label: `Resolve ${proposedFindings.length} review item${proposedFindings.length === 1 ? '' : 's'} before export.`,
        actionLabel: 'Review Items',
        onAction: () => setWorkspace('findings'),
        disabled: false,
      });
    }

    if (acceptedFindings.length > 0 && evidenceItems.length === 0) {
      blockers.push({
        id: 'link-evidence',
        label: 'Link at least one approved review item into evidence.',
        actionLabel: 'Open Packet',
        onAction: () => setWorkspace('packet'),
        disabled: false,
      });
    }

    if (unsavedChanges) {
      blockers.push({
        id: 'save-changes',
        label: 'Save document changes before creating the production copy.',
        actionLabel: 'Save Now',
        onAction: handleSave,
        disabled: !renderDoc,
      });
    }

    return blockers;
  }, [acceptedFindings.length, evidenceItems.length, handleOpen, handleSave, pdfjsReady, proposedFindings.length, renderDoc, setWorkspace, unsavedChanges]);
  const exportReady = productionBlockers.length === 0;
  const readinessLabel = exportReady
    ? 'Production-ready'
    : `${productionBlockers.length} blocker${productionBlockers.length === 1 ? '' : 's'} to clear`;
  const reviewFindings = useMemo(
    () => findings.filter((finding) => finding.page === currentPage),
    [findings, currentPage]
  );
  const assistantIntroActions = useMemo(() => ([
    {
      label: 'Upload Document',
      variant: 'primary',
      onClick: handleOpen,
      disabled: !pdfjsReady,
    },
    {
      label: 'Prepare Claim Packet',
      variant: 'secondary',
      onClick: () => setWorkspace('packet'),
      disabled: !renderDoc,
    },
    {
      label: 'Redact Personal Info',
      variant: 'secondary',
      onClick: runAutoRedact,
      disabled: !renderDoc,
    },
    {
      label: 'Open Editor',
      variant: 'secondary',
      onClick: () => setWorkspace('review'),
      disabled: false,
    },
  ]), [handleOpen, pdfjsReady, renderDoc, runAutoRedact, setWorkspace]);

  const findingsNextActions = useMemo(() => {
    const nextOpenFinding = proposedFindings[0] || null;

    return [
      {
        label: selectedFinding?.status === 'proposed' ? 'Approve Selected Item' : 'Review Next Open Item',
        primary: true,
        onClick: () => {
          if (selectedFinding?.status === 'proposed') {
            handleAcceptFinding(selectedFinding.id);
            return;
          }
          if (nextOpenFinding) setSelectedFindingId(nextOpenFinding.id);
        },
        disabled: !selectedFinding && !nextOpenFinding,
      },
      {
        label: 'Promote Selected to Evidence',
        onClick: () => selectedFinding && promoteFindingToEvidence(selectedFinding.id),
        disabled: !selectedFinding || selectedFinding.status === 'rejected',
      },
      {
        label: 'Return to Review Canvas',
        onClick: () => {
          if (selectedFinding?.page) setCurrentPageAndScroll(selectedFinding.page);
          setWorkspace('review');
        },
        disabled: !renderDoc,
      },
      {
        label: 'Open Packet Builder',
        onClick: () => setWorkspace('packet'),
        disabled: acceptedFindings.length === 0 && evidenceItems.length === 0,
      },
    ];
  }, [acceptedFindings.length, evidenceItems.length, handleAcceptFinding, proposedFindings, promoteFindingToEvidence, renderDoc, selectedFinding, setCurrentPageAndScroll, setSelectedFindingId, setWorkspace]);

  const packetNextActions = useMemo(() => ([
    {
      label: evidenceItems.length > 0 ? 'Open Export Workspace' : 'Link Evidence from Findings',
      primary: true,
      onClick: () => setWorkspace(evidenceItems.length > 0 ? 'export' : 'findings'),
      disabled: evidenceItems.length === 0 && acceptedFindings.length === 0,
    },
    {
      label: 'Review Approved Items',
      onClick: () => setWorkspace('findings'),
      disabled: findings.length === 0,
    },
    {
      label: 'Open Evidence Board',
      onClick: () => setWorkspace('evidence'),
      disabled: evidenceItems.length === 0,
    },
  ]), [acceptedFindings.length, evidenceItems.length, findings.length, setWorkspace]);

  const exportNextActions = useMemo(() => ([
    {
      label: renderDoc ? 'Save Production PDF' : 'Open PDF',
      primary: true,
      onClick: renderDoc ? handleSave : handleOpen,
      disabled: renderDoc ? false : !pdfjsReady,
    },
    {
      label: watermarkText ? 'Review Watermark' : 'Add Watermark',
      onClick: handleWatermark,
      disabled: !renderDoc,
    },
    {
      label: 'Export Word Copy',
      onClick: handleExportWord,
      disabled: !renderDoc,
    },
    {
      label: 'Print Production Copy',
      onClick: handlePrint,
      disabled: !renderDoc,
    },
  ]), [handleExportWord, handleOpen, handlePrint, handleSave, handleWatermark, pdfjsReady, renderDoc, watermarkText]);

  const quickStartSteps = useMemo(() => ([
    {
      id: 'open',
      index: '01',
      title: renderDoc ? 'Document loaded' : 'Open a PDF',
      description: renderDoc
        ? `${fileName} is ready for review.`
        : 'Load a PDF or create one from images to start the workbench.',
      status: renderDoc ? 'complete' : 'current',
      statusLabel: renderDoc ? 'Complete' : 'Start here',
      actionLabel: renderDoc ? 'Open another PDF' : 'Open PDF',
      onAction: handleOpen,
      disabled: !pdfjsReady,
      primary: !renderDoc,
    },
    {
      id: 'review',
      index: '02',
      title: proposedFindings.length > 0 ? 'Resolve review items' : 'Review and annotate',
      description: proposedFindings.length > 0
        ? `${proposedFindings.length} review item${proposedFindings.length === 1 ? '' : 's'} are waiting for a decision.`
        : 'Use markup, notes, and AI review to capture what matters on the page.',
      status: !renderDoc ? 'upcoming' : proposedFindings.length > 0 ? 'current' : 'complete',
      statusLabel: !renderDoc ? 'Waiting' : proposedFindings.length > 0 ? 'In progress' : 'Ready',
      actionLabel: proposedFindings.length > 0 ? 'Open review items' : 'Open review workspace',
      onAction: () => setWorkspace(proposedFindings.length > 0 ? 'findings' : 'review'),
      disabled: !renderDoc,
      primary: !!renderDoc && proposedFindings.length > 0,
    },
    {
      id: 'packet',
      index: '03',
      title: evidenceItems.length > 0 ? 'Packet building ready' : 'Promote key evidence',
      description: evidenceItems.length > 0
        ? `${evidenceItems.length} evidence item${evidenceItems.length === 1 ? '' : 's'} are ready for packet assembly.`
        : 'Turn approved findings into evidence before assembling the packet.',
      status: !renderDoc ? 'upcoming' : evidenceItems.length > 0 ? 'complete' : acceptedFindings.length > 0 ? 'current' : 'upcoming',
      statusLabel: !renderDoc ? 'Waiting' : evidenceItems.length > 0 ? 'Complete' : acceptedFindings.length > 0 ? 'Next step' : 'Waiting',
      actionLabel: evidenceItems.length > 0 ? 'Open packet builder' : 'Open findings',
      onAction: () => setWorkspace(evidenceItems.length > 0 ? 'packet' : 'findings'),
      disabled: !renderDoc || (acceptedFindings.length === 0 && evidenceItems.length === 0),
      primary: !!renderDoc && acceptedFindings.length > 0 && evidenceItems.length === 0,
    },
    {
      id: 'export',
      index: '04',
      title: exportReady ? 'Production export ready' : 'Clear production blockers',
      description: exportReady
        ? 'Save, print, or export a production copy with confidence.'
        : `${productionBlockers.length} blocker${productionBlockers.length === 1 ? '' : 's'} still need attention before export.`,
      status: !renderDoc ? 'upcoming' : exportReady ? 'complete' : 'current',
      statusLabel: !renderDoc ? 'Waiting' : exportReady ? 'Complete' : 'Must clear',
      actionLabel: exportReady ? 'Open export workspace' : 'Review blockers',
      onAction: () => setWorkspace(exportReady ? 'export' : 'packet'),
      disabled: !renderDoc,
      primary: !!renderDoc && exportReady,
    },
  ]), [acceptedFindings.length, evidenceItems.length, exportReady, fileName, handleOpen, pdfjsReady, productionBlockers.length, proposedFindings.length, renderDoc, setWorkspace]);

  const starterWorkflows = useMemo(() => ([
    {
      id: 'review-packet',
      title: 'Review a legal packet',
      description: 'Open a PDF, move through review, and leave with a production-safe export path.',
      duration: '3 min',
      outcome: renderDoc ? 'Resume the active matter in the review workspace.' : 'Start by loading a packet or claim file.',
      actionLabel: renderDoc ? 'Continue review' : 'Open PDF',
      onAction: renderDoc ? () => setWorkspace('review') : handleOpen,
      disabled: renderDoc ? false : !pdfjsReady,
      primary: true,
    },
    {
      id: 'ai-review',
      title: 'Run AI review on the current matter',
      description: 'Use MilPDF to summarize pages, extract dates, and stage review items before packet work begins.',
      duration: '2 min',
      outcome: renderDoc ? 'Launch the AI review flow against the loaded document.' : 'Load a document first, then use Ava to generate guided findings.',
      actionLabel: renderDoc ? 'Run AI review' : 'Load document first',
      onAction: renderDoc ? () => handleSuggestedAssistantAction('extract_dates') : handleOpen,
      disabled: renderDoc ? false : !pdfjsReady,
      primary: false,
    },
    {
      id: 'image-intake',
      title: 'Build a PDF from scans',
      description: 'Convert photos or scanned pages into a single PDF, then move straight into review and export.',
      duration: '2 min',
      outcome: 'Ideal for intake packets that arrive as phone photos or loose scans.',
      actionLabel: 'Create PDF from images',
      onAction: handleCreatePdfFromImages,
      disabled: false,
      primary: false,
    },
  ]), [handleCreatePdfFromImages, handleOpen, handleSuggestedAssistantAction, pdfjsReady, renderDoc, setWorkspace]);

  const pdfWorkbenchTools = useMemo(() => ([
    {
      id: 'document-prep',
      title: 'Document Prep',
      description: 'Open, combine, and create working PDFs before review begins.',
      items: [
        { label: 'Open PDF', detail: 'Load a PDF into the workbench.', actionLabel: 'Open', onAction: handleOpen, disabled: !pdfjsReady },
        { label: 'Create PDF from images', detail: 'Convert photos or scans into a single PDF.', actionLabel: 'Create', onAction: handleCreatePdfFromImages, disabled: false },
        { label: 'Merge PDF', detail: 'Append another PDF to the current document.', actionLabel: 'Merge', onAction: handleMerge, disabled: !renderDoc },
        { label: 'Insert pages from PDF', detail: 'Insert pages before or after the active page.', actionLabel: 'Insert', onAction: handleInsertPdfPages, disabled: !renderDoc },
      ],
    },
    {
      id: 'page-ops',
      title: 'Page Tools',
      description: 'Reshape the packet structure without leaving the review workspace.',
      items: [
        { label: 'Insert blank page', detail: 'Add a blank page before or after the current page.', actionLabel: 'Insert', onAction: handleAddBlank, disabled: !renderDoc },
        { label: 'Rotate page', detail: 'Rotate the current page clockwise.', actionLabel: 'Rotate', onAction: () => handleRotate(90), disabled: !renderDoc },
        { label: 'Extract page range', detail: 'Export a page range into a new PDF.', actionLabel: 'Extract', onAction: handleSplit, disabled: !renderDoc || numPages <= 1 },
        { label: 'Watermark document', detail: 'Apply or remove a review watermark before export.', actionLabel: watermarkText ? 'Edit' : 'Add', onAction: handleWatermark, disabled: !renderDoc },
      ],
    },
    {
      id: 'markup-export',
      title: 'Markup & Output',
      description: 'Use MilPDF for annotation, redaction, and production-ready exports.',
      items: [
        { label: 'Highlight and annotate', detail: 'Open the review workspace with drawing and text tools.', actionLabel: 'Review', onAction: () => setWorkspace('review'), disabled: false },
        { label: 'Redact personal info', detail: 'Scan for likely PII and stage redactions for review.', actionLabel: 'Scan', onAction: runAutoRedact, disabled: !renderDoc },
        { label: 'Export to Word', detail: 'Convert the current PDF into DOCX.', actionLabel: 'Export', onAction: handleExportWord, disabled: !renderDoc },
        { label: 'Print final PDF', detail: 'Render the current document with embedded changes.', actionLabel: 'Print', onAction: handlePrint, disabled: !renderDoc },
      ],
    },
  ]), [handleAddBlank, handleCreatePdfFromImages, handleExportWord, handleMerge, handleOpen, handleInsertPdfPages,
    handlePrint, handleRotate, handleSplit, handleWatermark, numPages, pdfjsReady, renderDoc,
    runAutoRedact, setWorkspace, watermarkText]);

  let workspaceContent = null;

  if (workspace === 'inbox') {
    workspaceContent = (
      <InboxWorkspace
        matterName={matterName}
        fileName={fileName}
        numPages={numPages}
        findings={findings}
        evidenceItems={evidenceItems}
        suggestedActions={assistantSuggestedActions}
        toolGroups={pdfWorkbenchTools}
        quickStartSteps={quickStartSteps}
        starterWorkflows={starterWorkflows}
        onOpenDocument={handleOpen}
        onCreatePdfFromImages={handleCreatePdfFromImages}
        onGoReview={() => setWorkspace('review')}
        onGoFindings={() => setWorkspace('findings')}
        onRunSuggestedAction={handleSuggestedAssistantAction}
      />
    );
  } else if (workspace === 'findings') {
    workspaceContent = (
      <FindingsWorkspace
        findings={findings}
        activeFilter={findingsFilter}
        selectedFindingId={selectedFindingId}
        onFilterChange={setFindingsFilter}
        onSelectFinding={setSelectedFindingId}
        onAcceptFinding={handleAcceptFinding}
        onRejectFinding={handleRejectFinding}
        onPromoteFinding={promoteFindingToEvidence}
        nextActions={findingsNextActions}
        onJumpToPage={(page) => {
          setCurrentPageAndScroll(page);
          setWorkspace('review');
        }}
      />
    );
  } else if (workspace === 'evidence') {
    workspaceContent = (
      <EvidenceWorkspace
        evidenceItems={evidenceItems}
        onJumpToPage={(page) => {
          setCurrentPageAndScroll(page);
          setWorkspace('review');
        }}
        onGoPacket={() => setWorkspace('packet')}
      />
    );
  } else if (workspace === 'packet') {
    workspaceContent = (
      <PacketWorkspace
        findings={findings}
        evidenceItems={evidenceItems}
        onGoExport={() => setWorkspace('export')}
        nextActions={packetNextActions}
        blockers={productionBlockers}
        readinessLabel={readinessLabel}
      />
    );
  } else if (workspace === 'export') {
    workspaceContent = (
      <ExportWorkspace
        objects={objects}
        watermarkText={watermarkText}
        renderDoc={renderDoc}
        onExportJson={handleExportJson}
        onImportJson={() => jsonInputRef.current?.click()}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportWord={handleExportWord}
        onToggleWatermark={handleWatermark}
        onPrint={handlePrint}
        onInsertPdfPages={handleInsertPdfPages}
        onCreatePdfFromImages={handleCreatePdfFromImages}
        nextActions={exportNextActions}
        blockers={productionBlockers}
        readinessLabel={readinessLabel}
        activityLog={workflowAuditTrail}
        exportReceipts={exportReceipts}
      />
    );
  } else {
    workspaceContent = (
      <ReviewWorkspace
        renderDoc={renderDoc}
        pdfjsReady={pdfjsReady}
        numPages={numPages}
        currentPage={currentPage}
        zoom={zoom}
        activeTool={activeTool}
        currentPageMeta={currentPageMeta}
        currentPageObjects={currentPageObjects}
        selectionIds={selectionIds}
        selectedObjects={selectedObjects}
        interactionState={interactionState}
        setInteractionState={setInteractionState}
        objects={objects}
        layers={layers}
        toolDefaults={toolDefaults}
        activeToolConfig={activeToolConfig}
        activeFormProfile={activeFormProfile}
        fileName={fileName}
        watermarkText={watermarkText}
        imagePlacement={imagePlacement}
        signatureDataUrl={signatureDataUrl}
        evidenceIndex={evidenceIndex}
        pageAnnotations={pageAnnotations}
        reviewFindings={reviewFindings}
        reviewPanelTab={reviewPanelTab}
        onReviewPanelTabChange={setReviewPanelTab}
        onViewerWheel={handleViewerWheel}
        onHandleOpen={handleOpen}
        onHandleInsertPdfPages={handleInsertPdfPages}
        onHandleToolChange={handleToolChange}
        onHandleToolDefaultChange={handleToolDefaultChange}
        onSetSelection={setSelection}
        onToggleVisible={handleToggleVisible}
        onToggleLocked={handleToggleLocked}
        onLayerReorder={handleLayerReorder}
        onUpdateObject={handleUpdateObject}
        onDeleteObject={handleDeleteObject}
        onSetActiveTool={setActiveTool}
        onJumpToPage={setCurrentPageAndScroll}
        onReorder={handleReorder}
        onDeletePageAt={handleDeletePageAt}
        onAddObject={handleAddObject}
        onBatchUpdateObjects={handleBatchUpdateObjects}
        onRequestSignature={() => setShowSignaturePad(true)}
        onCropApply={handleCropApply}
        onCropCancel={() => setActiveTool('select')}
        onDropFile={loadFile}
        onImagePlaced={handleImagePlaced}
        onImagePlacementCancel={handleImagePlacementCancel}
        onAskAva={handleAskAva}
        onRunSuggestedAction={handleSuggestedAssistantAction}
        assistantDockProps={{
          introActions: assistantIntroActions,
          actions: assistantSuggestedActions,
          runHistory: assistantRunHistory,
          hasDocument: !!renderDoc,
          documentName: fileName,
        }}
      />
    );
  }

  const shellRightPanel = assistantOpen && workspace !== 'review' ? (
    <AssistantDock
      onAsk={handleAskAva}
      onRunSuggestedAction={handleSuggestedAssistantAction}
      introActions={assistantIntroActions}
      actions={assistantSuggestedActions}
      runHistory={assistantRunHistory}
      hasDocument={!!renderDoc}
      documentName={fileName}
    />
  ) : null;

  return (
    <>
      {view === 'landing' ? (
        <LandingPage
          onLaunchEditor={() => {
            setView('editor');
            setWorkspace('inbox');
          }}
          onDownloadDesktop={() => {
            window.open('https://github.com/jhalstead175/milpdf/releases', '_blank', 'noopener');
          }}
        />
      ) : (
        <>
          <div className="app">
            <AppShell
              nav={(
                <PrimaryNav
                  items={WORKSPACE_ITEMS}
                  activeItem={workspace}
                  onChange={setWorkspace}
                />
              )}
              topbar={(
                <GlobalTopBar
                  workspaceLabel={workspaceLabel}
                  matterName={matterName}
                  documentName={fileName}
                  saveState={unsavedChanges ? 'Unsaved' : 'Saved'}
                  pageSummary={`${currentPage}/${numPages || 0}`}
                  readinessLabel={readinessLabel}
                  blockerCount={productionBlockers.length}
                  lastAction={lastWorkflowAction}
                  onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                  onToggleAssistant={toggleAssistant}
                  onSave={handleSave}
                  onExport={() => setWorkspace('export')}
                />
              )}
              main={workspaceContent}
              rightPanel={shellRightPanel}
              statusBar={(
                <StatusBar
                  page={currentPage}
                  numPages={numPages}
                  zoom={zoom}
                  findingsCount={findingsCount}
                  exportReady={exportReady}
                  unsavedChanges={unsavedChanges}
                  blockerCount={productionBlockers.length}
                  readinessLabel={readinessLabel}
                  lastAction={lastWorkflowAction}
                />
            )}
          />
        </div>

      {showSignaturePad && (
        <SignaturePad
          onSave={handleSignatureSave}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      <ActionReviewModal
        action={assistantActionProposal}
        loading={loading}
        onApprove={runAssistantAction}
        onClose={() => setAssistantActionProposal(null)}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
        onExecute={runCommand}
        hasDoc={!!renderDoc}
      />

      {showProfileModal && (
        <ProfileModal
          profile={profile}
          onSave={handleProfileSave}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {activeWorkflow === 'evidence-builder' && (
        <EvidenceBuilder
          profile={profile}
          onClose={() => setActiveWorkflow(null)}
        />
      )}

      {showInsertDialog && (
        <div className="modal-backdrop" onClick={() => setShowInsertDialog(false)}>
          <div className="modal insert-dialog" onClick={e => e.stopPropagation()}>
            <h3>Insert Page</h3>
            <p className="modal-hint">Insert a blank page or pages from another PDF</p>
            <h4 className="insert-section-label">Blank Page</h4>
            <div className="insert-options">
              <button className="btn-primary" onClick={() => handleInsertPage('before')}>
                Before Page {currentPage}
              </button>
              <button className="btn-primary" onClick={() => handleInsertPage('after')}>
                After Page {currentPage}
              </button>
            </div>
            <h4 className="insert-section-label">From PDF File</h4>
            <div className="insert-options">
              <button className="btn-primary" onClick={() => handleInsertFromPdf('before')}>
                Before Page {currentPage}
              </button>
              <button className="btn-primary" onClick={() => handleInsertFromPdf('after')}>
                After Page {currentPage}
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowInsertDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        disabled={!pdfjsReady}
        onChange={handleFileChange}
      />
      <input
        ref={mergeInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handleMergeFile}
      />
      <input
        ref={insertFileRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handleInsertFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleImageFiles}
      />
      <input
        ref={imagesToPdfInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleImagesToPdfFiles}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportJson}
      />
        </>
      )}
    </>
  );
}

export default App;
