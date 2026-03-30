import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import LandingPage from './components/LandingPage';
import './components/LandingPage.css';
import V3AppShell from './app/AppShell';
import PageThumbnails from './components/PageThumbnails';
import PDFViewer from './components/PDFViewer';
import CommandPalette from './components/CommandPalette';
import SignaturePad from './components/SignaturePad';
import ProfileModal from './components/ProfileModal';
import LayersPanel from './components/LayersPanel';
import InspectorPanel from './components/InspectorPanel';
import EvidencePanel from './components/EvidencePanel';
import CaseGraph from './components/CaseGraph';
import AvaPanel from './components/AvaPanel';
import ToastStack from './components/ToastStack';
import { useEditorStore } from './core/sceneGraph/store';
import {
  loadPdf, deletePage, reorderPages, rotatePage,
  addBlankPage, mergePdf, insertPdf, cropPage,
  saveWithDialog, downloadBlob, addWatermark, splitPdf, printPdf,
} from './utils/pdfUtils';
import { secureEmbed } from './core/export';
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
import { buildEvidenceIndex, exportEvidenceBundle } from './core/evidence';
import { buildCaseGraph } from './core/caseGraph';
import { buildCaseContext, askAva } from './core/ai';
import { createKernel, CORE_MODULES, PLUGIN_CONFIG, PLUGIN_CATALOG } from './core/kernel';
import './App.css';

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
const SHELL_TABS = ['tools', 'annotate', 'pages', 'export'];
const TOOL_RAIL_ITEMS = [
  { id: 'select', glyph: '↖', label: 'Select' },
  { id: 'highlight', glyph: '▬', label: 'Highlight' },
  { id: 'draw', glyph: '✏', label: 'Draw' },
  { id: 'text', glyph: 'T', label: 'Text' },
  { id: 'note', glyph: '📌', label: 'Note' },
  { id: 'eraser', glyph: '⌫', label: 'Eraser' },
];

let pageMetaSeed = 0;

function nextPageMetaId() {
  pageMetaSeed += 1;
  return `page-meta-${pageMetaSeed}`;
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

function getAnnotationSummary(obj) {
  if (obj.type === 'text') return obj.text?.trim() || 'Text annotation';
  if (obj.type === 'drawing') return 'Freehand drawing';
  if (obj.type === 'highlight') return 'Highlight';
  if (obj.type === 'redact') return 'Redaction';
  if (obj.type === 'whiteout') return 'Whiteout';
  if (obj.type === 'signature') return 'Signature';
  if (obj.type === 'image') return obj.name || 'Image';
  return obj.name || obj.type;
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

function App() {
  const [view, setView] = useState('landing');
  const [showV3, setShowV3] = useState(false);
  const kernel = useMemo(() => createKernel(), []);
  const [toasts, setToasts] = useState([]);
  const [pdfjsReady, setPdfjsReady] = useState(false);

  useEffect(() => {
    if (isElectron) setView('editor');
  }, []);

  useEffect(() => {
    kernel.init(CORE_MODULES, PLUGIN_CONFIG, PLUGIN_CATALOG);
  }, [kernel]);

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

  useEffect(() => {
    const offLoaded = kernel.eventBus.on('document:loaded', ({ pages }) => {
      pushToast({ type: 'info', title: 'Document Loaded', message: `${pages} pages ready.` });
    });
    const offAnn = kernel.eventBus.on('annotation:created', ({ object }) => {
      pushToast({ type: 'info', title: 'Annotation Added', message: object?.type || 'Annotation' });
    });
    const offEvidence = kernel.eventBus.on('evidence:created', ({ object }) => {
      pushToast({ type: 'success', title: 'Evidence Marker', message: object?.label || 'Evidence marker created.' });
    });
    const offTimeline = kernel.eventBus.on('timeline:updated', () => {
      pushToast({ type: 'info', title: 'Timeline Updated' });
    });
    return () => {
      offLoaded();
      offAnn();
      offEvidence();
      offTimeline();
    };
  }, [kernel, pushToast]);

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
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthReport, setHealthReport] = useState(null);
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
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [profile, setProfile] = useState(() => loadProfile());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [formProfileKey, setFormProfileKey] = useState(null);

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
  const jsonInputRef = useRef(null);
  const [insertPosition, setInsertPosition] = useState('after');
  const [imagePlacementQueue, setImagePlacementQueue] = useState([]);
  const [imagePlacement, setImagePlacement] = useState(null);
  const [panelTab, setPanelTab] = useState(null);
  const [toolDefaults, setToolDefaults] = useState({
    text: {
      fontSize: 16,
      color: '#000000',
      fontFamily: 'Helvetica',
    },
    highlight: {
      color: '#c9a84c',
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
    kernel.eventBus.emit('document:loaded', {
      pages: result.pdfDoc.getPageCount(),
    });
    return nextPageMeta;
  }, [pageMeta, setPageMeta, kernel]);

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
    } catch (err) {
      alert('Failed to load PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfjsReady, updateFromResult, resetObjects, setSelection, setActiveTool]);

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

  const handleSave = useCallback(async () => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      let bytes = pdfBytes;
      if (objects.length > 0) {
        bytes = await secureEmbed(bytes, objects, layers, renderDoc, { flattenForm: true });
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
    } catch (err) {
      alert('Failed to save PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, objects, fileName, watermarkText, layers]);

  const handleSaveAs = useCallback(async () => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      let bytes = pdfBytes;
      if (objects.length > 0) {
        bytes = await secureEmbed(bytes, objects, layers, renderDoc, { flattenForm: true });
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
    } catch (err) {
      alert('Failed to save PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, objects, fileName, watermarkText, layers]);

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
      commitHistory(prev =>
        prev
          .filter((annotation) => {
            if (removedPageMeta?.id && annotation.pageId) return annotation.pageId !== removedPageMeta.id;
            return annotation.page !== pageNumber;
          })
          .map((annotation) => (
            annotation.pageId || annotation.page <= pageNumber
              ? annotation
              : { ...annotation, page: annotation.page - 1 }
          ))
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
        bytes = await secureEmbed(bytes, objects, layers, renderDoc, { flattenForm: true });
      }
      if (watermarkText) {
        bytes = await addWatermark(bytes, watermarkText);
      }
      printPdf(bytes);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, objects, watermarkText, layers]);

  // --- Export ---
  const handleExportWord = useCallback(async () => {
    if (!renderDoc) return;
    setLoading(true);
    try {
      await convertPdfToWord(renderDoc, fileName.replace(/\.pdf$/i, '.docx'));
    } catch (err) {
      alert('Failed to export to Word: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [renderDoc, fileName]);

  

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
const activeFormProfile = useMemo(
 () => (formProfileKey ? FORM_PROFILES[formProfileKey] : null),
 [formProfileKey]
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
  const handleAddObject = useCallback((obj) => {
    const nextObject = obj.pageId || !currentPageMeta?.id ? obj : { ...obj, pageId: currentPageMeta.id };
    addObject(nextObject);
    kernel.eventBus.emit('annotation:created', { object: nextObject });
    if (nextObject?.type === 'evidenceMarker') {
      kernel.eventBus.emit('evidence:created', { object: nextObject });
      if (nextObject.timestamp) kernel.eventBus.emit('timeline:updated', { object: nextObject });
    }
  }, [addObject, currentPageMeta, kernel]);

  const handleAddObjects = useCallback((newObjects) => {
    const normalizedObjects = newObjects.map((obj) => (
      obj.pageId || !currentPageMeta?.id || obj.page !== currentPage
        ? obj
        : { ...obj, pageId: currentPageMeta.id }
    ));
    addObjects(normalizedObjects);
    normalizedObjects.forEach(obj => {
      kernel.eventBus.emit('annotation:created', { object: obj });
      if (obj?.type === 'evidenceMarker') {
        kernel.eventBus.emit('evidence:created', { object: obj });
        if (obj.timestamp) kernel.eventBus.emit('timeline:updated', { object: obj });
      }
    });
  }, [addObjects, currentPage, currentPageMeta, kernel]);

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
    });
  }, [loadFromBuffer, queueImagePlacements, setView]);

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
    if (updates?.timestamp) kernel.eventBus.emit('timeline:updated', { id, updates });
  }, [updateObject, kernel]);

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

  const handleExportEvidenceBundle = useCallback(async ({ prefix, startNumber }) => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      const bytes = await exportEvidenceBundle({
        pdfBytes,
        exhibits: evidenceIndex.exhibits,
        markers: evidenceIndex.markers,
        batesPrefix: prefix || 'MILPDF-',
        batesStartNumber: startNumber || 1,
        title: 'Evidence Bundle',
      });
      const filename = fileName.replace(/\.pdf$/i, '_evidence_bundle.pdf');
      if (isElectron) {
        const base64 = btoa(
          new Uint8Array(bytes).reduce((s, b) => s + String.fromCharCode(b), '')
        );
        await window.electronAPI.saveFileDialog(filename, base64);
      } else {
        await saveWithDialog(bytes, filename);
      }
    } catch (err) {
      alert('Failed to export evidence bundle: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, evidenceIndex, fileName]);

  const handleAskAva = useCallback(async (question) => {
    const context = await buildCaseContext({
      renderDoc,
      evidenceIndex,
      caseGraph,
    });
    return askAva(question, context);
  }, [renderDoc, evidenceIndex, caseGraph]);

  const handleKernelHealthCheck = useCallback(() => {
    try {
      const report = kernel.commandBus.execute('plugin.health.check');
      setHealthReport(report || { services: [], timestamp: new Date().toISOString() });
      setShowHealthModal(true);
    } catch (err) {
      pushToast({ type: 'info', title: 'Kernel Health', message: err.message });
    }
  }, [kernel, pushToast]);

  useEffect(() => {
    setSelection(prev => prev.filter(id => objects.some(o => o.id === id)));
  }, [objects, setSelection]);

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
  const activeFormProfile = useMemo(
    () => (formProfileKey ? FORM_PROFILES[formProfileKey] : null),
    [formProfileKey]
  );
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
    setCurrentPage(page);
  }, []);

  const togglePanelTab = useCallback((tab) => {
    setPanelTab(prev => (prev === tab ? null : tab));
  }, []);

  const handleRailToolClick = useCallback((toolId) => {
    if (toolId === 'note') {
      handleToolChange('signature');
      return;
    }
    if (toolId === 'eraser') {
      setActiveTool('edit');
      return;
    }
    setActiveTool(toolId);
  }, [handleToolChange, setActiveTool]);

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
    setShowSignaturePad,
    signatureDataUrl,
    setZoom,
    setCurrentPage,
    numPages,
    toggleCommandPalette: () => setShowCommandPalette(p => !p),
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
    runKernelHealthCheck: handleKernelHealthCheck,
    }), [renderDoc, setActiveTool, handleToolChange, handleOpen, handleSave, handleSaveAs, handleMerge, handleSplit, handleRotate,
      handleAddBlank, handleDeletePage, handlePrint, handleExportWord, handleWatermark, handleImportImages,
      signatureDataUrl, setZoom, setCurrentPage, numPages, setActiveWorkflow, runDD214Analysis,
      runAutoRedact, handleAlignment, handleZOrder, handleCopy, handlePaste, handleDuplicate,
      undo, redo, handleAutoFill, setShowProfileModal, handleKernelHealthCheck]);

  const commands = useMemo(() => buildCommandRegistry(commandContext), [commandContext]);

  useEffect(() => {
    commands.forEach(cmd => {
      kernel.commandBus.register(cmd.id, () => cmd.execute(commandContext));
    });
    return () => {
      commands.forEach(cmd => kernel.commandBus.unregister(cmd.id));
    };
  }, [commands, commandContext, kernel]);

  const runCommand = useCallback((id) => {
    kernel.commandBus.execute(id);
  }, [kernel]);

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
        // Ctrl+Shift+Z → redo (Mac/Linux convention alongside Ctrl+Y)
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

  return (
    <>
      {view === 'landing' ? (
        <LandingPage
          onLaunchEditor={() => setView('editor')}
          onDownloadDesktop={() => {
            window.open('https://github.com/jhalstead175/milpdf/releases', '_blank', 'noopener');
          }}
        />
      ) : (
    <div className="app">
      <div className="acrobat-topbar">
        <div className="acrobat-tabs">
          {SHELL_TABS.map((tab) => (
            <button
              key={tab}
              className={`acrobat-tab ${panelTab === tab ? 'active' : ''}`}
              onClick={() => togglePanelTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="acrobat-topbar-right">
          <div className="acrobat-file-display" title={fileName}>
            {fileName}
          </div>
          <div className="acrobat-zoom-controls">
            <button onClick={() => runCommand('view.zoom.out')} disabled={!renderDoc || zoom <= 0.25}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => runCommand('view.zoom.in')} disabled={!renderDoc || zoom >= 3}>+</button>
          </div>
        </div>
      </div>

      <div className="main-content">
        {showV3 ? (
          <V3AppShell />
        ) : (
          <div className={`editor-shell ${panelTab ? 'panel-open' : 'panel-closed'}`}>
            <div className="tool-rail">
              {TOOL_RAIL_ITEMS.map((item) => {
                const mappedTool = item.id === 'note' ? 'signature' : item.id === 'eraser' ? 'edit' : item.id;
                const isActive = activeTool === mappedTool;
                return (
                  <button
                    key={item.id}
                    className={`tool-rail-button ${isActive ? 'active' : ''}`}
                    onClick={() => handleRailToolClick(item.id)}
                    title={item.label}
                    disabled={!renderDoc || !pdfjsReady}
                  >
                    <span>{item.glyph}</span>
                  </button>
                );
              })}
            </div>

            <div className={`context-panel ${panelTab ? 'open' : ''}`}>
              <div className="context-panel-header">
                <span>{panelTab ? panelTab.toUpperCase() : ''}</span>
                <button
                  className="context-panel-collapse"
                  onClick={() => setPanelTab(null)}
                  title="Collapse panel"
                  aria-label="Collapse panel"
                >
                  ◀
                </button>
              </div>
              <div className="context-panel-body">
                {panelTab === 'tools' && (
                  <>
                    {!renderDoc && (
                        <div className="context-card">
                          <div className="context-card-title">Open a PDF</div>
                          <button className="btn-primary" onClick={handleOpen} disabled={!pdfjsReady}>Open Document</button>
                        </div>
                      )}
                    <div className="context-card">
                      <div className="context-card-title">Active Tool</div>
                      <div className="context-tool-name">{activeToolConfig.title}</div>
                      {activeToolConfig.fields.length === 0 ? (
                        <div className="context-muted">No adjustable options for this tool.</div>
                      ) : (
                        activeToolConfig.fields.map((field) => {
                          const value = toolDefaults[activeToolConfig.key]?.[field.key];
                          return (
                            <label key={field.key} className="context-field">
                              <span>{field.label}</span>
                              {field.type === 'color' ? (
                                <input
                                  type="color"
                                  value={value}
                                  onChange={(e) => handleToolDefaultChange(activeToolConfig.key, field.key, e.target.value)}
                                />
                              ) : (
                                <>
                                  <input
                                    type="range"
                                    min={field.min}
                                    max={field.max}
                                    step={field.step}
                                    value={value}
                                    onChange={(e) => handleToolDefaultChange(
                                      activeToolConfig.key,
                                      field.key,
                                      Number(e.target.value)
                                    )}
                                  />
                                  <strong>{value}</strong>
                                </>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                    {activeFormProfile && (
                      <div className="context-card">
                        <div className="context-card-title">Detected Form</div>
                        <div className="context-tool-name">{activeFormProfile.name}</div>
                        <div className="context-summary">Auto-fill available from the saved veteran profile.</div>
                        <div className="context-actions">
                          <button className="btn-secondary" onClick={() => setShowProfileModal(true)}>
                            Edit Profile
                          </button>
                          <button className="btn-primary" onClick={handleAutoFill}>
                            Auto-fill
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="context-card">
                      <div className="context-card-title">Document Actions</div>
                      <div className="context-actions">
                        <button className="btn-secondary" onClick={handleOpen} disabled={!pdfjsReady}>Open</button>
                        <button className="btn-secondary" onClick={handleSave} disabled={!renderDoc || !pdfjsReady}>Save</button>
                        <button className="btn-secondary" onClick={handleSaveAs} disabled={!renderDoc || !pdfjsReady}>Save As</button>
                        <button className="btn-secondary" onClick={handlePrint} disabled={!renderDoc || !pdfjsReady}>Print</button>
                        <button className="btn-secondary" onClick={handleImportImages} disabled={!renderDoc || !pdfjsReady}>Import Images</button>
                        <button className="btn-secondary" onClick={() => setShowSignaturePad(true)} disabled={!renderDoc || !pdfjsReady}>Signature</button>
                        <button className="btn-secondary" onClick={handleMerge} disabled={!renderDoc || !pdfjsReady}>Merge PDF</button>
                        <button className="btn-secondary" onClick={() => setShowV3(prev => !prev)}>
                          {showV3 ? 'Editor Shell' : 'V3 Shell'}
                        </button>
                      </div>
                    </div>
                    <LayersPanel
                      objects={currentPageObjects}
                      selectionIds={selectionIds}
                      onSelectionChange={setSelection}
                      onToggleVisible={handleToggleVisible}
                      onToggleLocked={handleToggleLocked}
                      onReorder={handleLayerReorder}
                    />
                    <InspectorPanel
                      selectedObjects={selectedObjects}
                      onUpdateObject={handleUpdateObject}
                    />
                  </>
                )}

                {panelTab === 'annotate' && (
                  <>
                    <div className="context-card">
                      <div className="context-card-title">Current Page Annotations</div>
                      {pageAnnotations.length === 0 ? (
                        <div className="context-muted">No annotations on this page.</div>
                      ) : (
                        <div className="annotation-list">
                          {pageAnnotations.map((obj) => (
                            <div
                              key={obj.id}
                              className={`annotation-list-item ${selectionIds.includes(obj.id) ? 'selected' : ''}`}
                            >
                              <button
                                className="annotation-select"
                                onClick={() => {
                                  setSelection([obj.id]);
                                  setActiveTool('select');
                                }}
                              >
                                <strong>{obj.type}</strong>
                                <span>{getAnnotationSummary(obj)}</span>
                              </button>
                              <button
                                className="annotation-delete-btn"
                                onClick={() => handleDeleteObject(obj.id)}
                                title="Delete annotation"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <EvidencePanel
                      markers={evidenceIndex.markers}
                      exhibits={evidenceIndex.exhibits}
                      onJumpToPage={setCurrentPageAndScroll}
                      onExportBundle={handleExportEvidenceBundle}
                    />
                    <CaseGraph
                      graph={caseGraph}
                      onNavigate={setCurrentPageAndScroll}
                    />
                    <AvaPanel onAsk={handleAskAva} />
                  </>
                )}

                {panelTab === 'pages' && (
                  <>
                    <div className="context-card">
                      <div className="context-card-title">Page Actions</div>
                      <div className="context-actions">
                        <button className="btn-secondary" onClick={handleAddBlank} disabled={!renderDoc}>Insert Blank</button>
                        <button className="btn-secondary" onClick={() => handleRotate(90)} disabled={!renderDoc}>Rotate 90</button>
                        <button className="btn-secondary" onClick={handleDeletePage} disabled={!renderDoc || numPages <= 1}>Delete Current</button>
                        <button className="btn-secondary" onClick={handleSplit} disabled={!renderDoc || numPages <= 1}>Split / Extract</button>
                      </div>
                    </div>
                    <PageThumbnails
                      renderDoc={renderDoc}
                      numPages={numPages}
                      currentPage={currentPage}
                      onPageSelect={setCurrentPageAndScroll}
                      onReorder={handleReorder}
                      onDeletePage={handleDeletePageAt}
                      showHeader={false}
                    />
                  </>
                )}

                {panelTab === 'export' && (
                  <>
                    <div className="context-card">
                      <div className="context-card-title">Annotation Data</div>
                      <div className="context-summary">Total annotations: <strong>{objects.length}</strong></div>
                      <div className="context-actions">
                        <button className="btn-secondary" onClick={handleExportJson} disabled={!renderDoc}>Export JSON</button>
                        <button className="btn-secondary" onClick={() => jsonInputRef.current?.click()} disabled={!renderDoc}>Import JSON</button>
                      </div>
                    </div>
                    <div className="context-card">
                      <div className="context-card-title">Document Export</div>
                      <div className="context-actions">
                        <button className="btn-secondary" onClick={handleSave} disabled={!renderDoc}>Save PDF</button>
                        <button className="btn-secondary" onClick={handleSaveAs} disabled={!renderDoc}>Save As</button>
                        <button className="btn-secondary" onClick={handleExportWord} disabled={!renderDoc}>Export Word</button>
                        <button className="btn-secondary" onClick={handleWatermark} disabled={!renderDoc}>
                          {watermarkText ? 'Remove Watermark' : 'Add Watermark'}
                        </button>
                        <button className="btn-secondary" onClick={handlePrint} disabled={!renderDoc}>Print</button>
                        {import.meta.env?.DEV && (
                          <button className="btn-secondary" onClick={handleKernelHealthCheck}>Kernel Health</button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="canvas-stage">
              <div className="canvas-scroll-container">
                <div className="canvas-stage-inner">
                  <PDFViewer
                    renderDoc={renderDoc}
                    currentPage={currentPage}
                    zoom={zoom}
                    activeTool={activeTool}
                    objects={objects}
                    pageObjects={currentPageObjects}
                    currentPageId={currentPageMeta?.id || null}
                    layers={layers}
                    selectionIds={selectionIds}
                    onSelectionChange={setSelection}
                    interactionState={interactionState}
                    setInteractionState={setInteractionState}
                    onAddObject={handleAddObject}
                    onDeleteObject={handleDeleteObject}
                    onUpdateObject={handleUpdateObject}
                    onBatchUpdateObjects={handleBatchUpdateObjects}
                    signatureDataUrl={signatureDataUrl}
                    onRequestSignature={() => setShowSignaturePad(true)}
                    onCropApply={handleCropApply}
                    onCropCancel={() => setActiveTool('select')}
                    onDropFile={loadFile}
                    watermarkText={watermarkText}
                    imagePlacement={imagePlacement}
                    onImagePlaced={handleImagePlaced}
                    onImagePlacementCancel={handleImagePlacementCancel}
                    toolDefaults={toolDefaults}
                    pdfjsReady={pdfjsReady}
                  />
                </div>
              </div>
              {renderDoc && (
                <div className="canvas-page-pill">
                  <button onClick={() => setCurrentPageAndScroll(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>&lt;</button>
                  <span>{currentPage} / {numPages}</span>
                  <button onClick={() => setCurrentPageAndScroll(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages}>&gt;</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showSignaturePad && (
        <SignaturePad
          onSave={handleSignatureSave}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
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

      {showHealthModal && (
        <div className="modal-backdrop" onClick={() => setShowHealthModal(false)}>
          <div className="modal health-modal" onClick={e => e.stopPropagation()}>
            <h3>Kernel Health Check</h3>
            <p className="modal-hint">Services registered in the kernel.</p>
            <div className="health-services">
              {(healthReport?.services || []).map((service) => (
                <div key={service} className="health-service-item">{service}</div>
              ))}
              {(healthReport?.services || []).length === 0 && (
                <div className="health-service-item empty">No services reported.</div>
              )}
            </div>
            <div className="health-timestamp">
              Last check: {healthReport?.timestamp || 'unknown'}
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowHealthModal(false)}>Close</button>
            </div>
          </div>
        </div>
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
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportJson}
      />
    </div>
      )}
    </>
  );
}

export default App;
