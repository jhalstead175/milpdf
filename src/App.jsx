import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import LandingPage from './components/LandingPage';
import './components/LandingPage.css';
import Toolbar from './components/Toolbar';
import PageThumbnails from './components/PageThumbnails';
import DocumentNavigator from './components/DocumentNavigator';
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
  addBlankPage, mergePdf, insertPdf, imagesToPdf, cropPage,
  saveWithDialog, downloadBlob, addWatermark, splitPdf, printPdf,
} from './utils/pdfUtils';
import { embedEditorObjects } from './core/export';
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

function App() {
  const [view, setView] = useState('landing');
  const kernel = useMemo(() => createKernel(), []);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (isElectron) setView('editor');
  }, []);

  useEffect(() => {
    kernel.init(CORE_MODULES, PLUGIN_CONFIG, PLUGIN_CATALOG);
  }, [kernel]);

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
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthReport, setHealthReport] = useState(null);
  const editorStore = useEditorStore([]);
  const {
    objects,
    pages,
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
    canUndo,
    canRedo,
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
  const [insertPosition, setInsertPosition] = useState('after');

  const buildPageMeta = useCallback((doc) => (
    doc.getPages().map((page, index) => ({
      id: `page-${index + 1}`,
      number: index + 1,
      width: page.getWidth(),
      height: page.getHeight(),
      rotation: page.getRotation().angle || 0,
    }))
  ), []);

  const updateFromResult = useCallback((result) => {
    setPdfDoc(result.pdfDoc);
    setPdfBytes(result.bytes);
    setRenderDoc(result.renderDoc);
    setNumPages(result.pdfDoc.getPageCount());
    setPageMeta(buildPageMeta(result.pdfDoc));
    kernel.eventBus.emit('document:loaded', {
      pages: result.pdfDoc.getPageCount(),
    });
  }, [buildPageMeta, setPageMeta, kernel]);

  // --- Load a PDF from ArrayBuffer + name ---
  const loadFromBuffer = useCallback(async (buffer, name) => {
    setLoading(true);
    try {
      const result = await loadPdf(buffer);
      updateFromResult(result);
      setFileName(name);
      setCurrentPage(1);
      const formFields = await Promise.all(
        Array.from({ length: result.pdfDoc.getPageCount() }, (_, i) =>
          detectFormFields(result.renderDoc, i + 1)
        )
      ).then(pages => pages.flat());
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
  }, [updateFromResult, resetObjects, setSelection, setActiveTool]);

  // --- Load a PDF from File object (browser drag-drop / input) ---
  const loadFile = useCallback(async (file) => {
    const buffer = await file.arrayBuffer();
    await loadFromBuffer(buffer, file.name);
  }, [loadFromBuffer]);

  // --- Listen for files opened via OS file association (Electron) ---
  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.onOpenFile(async (fileInfo) => {
      const bytes = Uint8Array.from(atob(fileInfo.data), c => c.charCodeAt(0));
      await loadFromBuffer(bytes.buffer, fileInfo.name);
    });
    window.electronAPI.onOpenImages(async (images) => {
      // Convert base64 images to File objects and run imagesToPdf
      const files = images.map(img => {
        const binary = atob(img.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const ext = img.name.split('.').pop().toLowerCase();
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', bmp: 'image/bmp', gif: 'image/gif', webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff' };
        return new File([bytes], img.name, { type: mimeMap[ext] || 'image/png' });
      });
      files.sort((a, b) => a.name.localeCompare(b.name));
      try {
        const result = await imagesToPdf(files);
        setPdfDoc(result.pdfDoc);
        setPdfBytes(result.bytes);
        setRenderDoc(result.renderDoc);
        setNumPages(result.pdfDoc.getPageCount());
        setCurrentPage(1);
        setFileName('images.pdf');
        resetObjects([]);
        setSelection([]);
        setFormProfileKey(null);
        setView('editor');
      } catch (err) {
        alert('Failed to convert images: ' + err.message);
      }
    });
  }, [loadFromBuffer, resetObjects, setSelection]);

  // --- File operations ---
  const handleOpen = useCallback(async () => {
    if (isElectron) {
      const fileInfo = await window.electronAPI.openFileDialog();
      if (!fileInfo) return;
      const bytes = Uint8Array.from(atob(fileInfo.data), c => c.charCodeAt(0));
      await loadFromBuffer(bytes.buffer, fileInfo.name);
    } else {
      fileInputRef.current?.click();
    }
  }, [loadFromBuffer]);

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
        bytes = await embedEditorObjects(bytes, objects, layers, { flattenForm: true });
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
      updateFromResult(result);
      setCurrentPage(atIndex + 1);
    } catch (err) {
      alert('Failed to insert page: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, currentPage, updateFromResult]);

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
      updateFromResult(result);
      setCurrentPage(atIndex + 1);
    } catch (err) {
      alert('Failed to insert PDF: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }, [pdfDoc, currentPage, insertPosition, updateFromResult]);

  const handleDeletePage = useCallback(async () => {
    if (!pdfDoc || numPages <= 1) return;
    if (!confirm(`Delete page ${currentPage}?`)) return;
    setLoading(true);
    try {
      const result = await deletePage(pdfDoc, currentPage - 1);
      updateFromResult(result);
      setCurrentPage(Math.min(currentPage, result.pdfDoc.getPageCount()));
      commitHistory(prev =>
        prev
          .filter(a => a.page !== currentPage)
          .map(a => a.page > currentPage ? { ...a, page: a.page - 1 } : a)
      );
    } catch (err) {
      alert('Failed to delete page: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, currentPage, numPages, updateFromResult, commitHistory]);

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
      updateFromResult(result);
      setCurrentPage(toIndex + 1);
      commitHistory(prev => prev.map(a => {
        const oldPageIndex = a.page - 1;
        const newPos = order.indexOf(oldPageIndex);
        return { ...a, page: newPos + 1 };
      }));
    } catch (err) {
      alert('Failed to reorder pages: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, numPages, updateFromResult, commitHistory]);

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
        bytes = await embedEditorObjects(bytes, objects, layers, { flattenForm: true });
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
    addObject(obj);
    kernel.eventBus.emit('annotation:created', { object: obj });
    if (obj?.type === 'evidenceMarker') {
      kernel.eventBus.emit('evidence:created', { object: obj });
      if (obj.timestamp) kernel.eventBus.emit('timeline:updated', { object: obj });
    }
  }, [addObject, kernel]);

  const handleAddObjects = useCallback((newObjects) => {
    addObjects(newObjects);
    newObjects.forEach(obj => {
      kernel.eventBus.emit('annotation:created', { object: obj });
      if (obj?.type === 'evidenceMarker') {
        kernel.eventBus.emit('evidence:created', { object: obj });
        if (obj.timestamp) kernel.eventBus.emit('timeline:updated', { object: obj });
      }
    });
  }, [addObjects, kernel]);

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

  // --- Images to PDF ---
  const handleImagesToPdf = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    try {
      // Sort files by name for predictable page order
      files.sort((a, b) => a.name.localeCompare(b.name));
      const result = await imagesToPdf(files);
      setPdfDoc(result.pdfDoc);
      setPdfBytes(result.bytes);
      setRenderDoc(result.renderDoc);
      setNumPages(result.pdfDoc.getPageCount());
      setCurrentPage(1);
      setFileName('images.pdf');
      resetObjects([]);
      setSelection([]);
      setFormProfileKey(null);
    } catch (err) {
      alert('Failed to convert images: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }, [resetObjects, setSelection]);

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
  const currentPageObjects = useMemo(
    () => pages[currentPage - 1]?.objects || [],
    [pages, currentPage]
  );
  const activeFormProfile = useMemo(
    () => (formProfileKey ? FORM_PROFILES[formProfileKey] : null),
    [formProfileKey]
  );
  const handleCopy = useCallback(() => {
    copyObjects(objects, selectedSet);
  }, [objects, selectedSet]);

  const handlePaste = useCallback(() => {
    const pasted = pasteObjects(currentPage);
    handleAddObjects(pasted);
    setSelection(pasted.map(o => o.id));
  }, [currentPage, handleAddObjects, setSelection]);

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

  const commandContext = useMemo(() => ({
    hasDoc: !!renderDoc,
    setActiveTool,
    handleToolChange,
    handleOpen,
    handleSave,
    handleMerge,
    handleSplit,
    handleRotate,
    handleAddBlank,
    handleDeletePage,
    handlePrint,
    handleExportWord,
    handleWatermark,
    handleImagesToPdf,
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
  }), [renderDoc, setActiveTool, handleToolChange, handleOpen, handleSave, handleMerge, handleSplit, handleRotate,
    handleAddBlank, handleDeletePage, handlePrint, handleExportWord, handleWatermark, handleImagesToPdf,
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
        const key = eventToShortcut(e);
        const cmdId = key ? shortcutMap.get(key) : null;
        if (cmdId) {
          e.preventDefault();
          runCommand(cmdId);
          return;
        }
      }

      if (e.key === 'ArrowLeft' && !inInput && selectionIds.length === 0) {
        setCurrentPage(p => Math.max(1, p - 1));
      }
      else if (e.key === 'ArrowRight' && !inInput && selectionIds.length === 0) {
        setCurrentPage(p => Math.min(numPages, p + 1));
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
    handleBatchUpdateObjects, runCommand, shortcutMap]);

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
      <Toolbar
        runCommand={runCommand}
        activeTool={activeTool}
        zoom={zoom}
        hasDoc={!!renderDoc}
        currentPage={currentPage}
        numPages={numPages}
        canUndo={canUndo}
        canRedo={canRedo}
        watermarkText={watermarkText}
        canZOrder={selectionIds.length > 0}
      />

      {activeFormProfile && (
        <div className="form-profile-banner">
          <div>
            Detected {activeFormProfile.name}. Auto-fill from saved profile?
          </div>
          <div className="form-profile-actions">
            <button className="btn-secondary" onClick={() => setShowProfileModal(true)}>
              Edit Profile
            </button>
            <button className="btn-primary" onClick={handleAutoFill}>
              Auto-fill Fields
            </button>
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="sidebar">
          <PageThumbnails
            renderDoc={renderDoc}
            numPages={numPages}
            currentPage={currentPage}
            onPageSelect={setCurrentPage}
            onReorder={handleReorder}
          />
          <DocumentNavigator
            renderDoc={renderDoc}
            numPages={numPages}
            currentPage={currentPage}
            onPageSelect={setCurrentPage}
          />
        </div>

        <PDFViewer
          renderDoc={renderDoc}
          currentPage={currentPage}
          zoom={zoom}
          activeTool={activeTool}
          objects={objects}
          pageObjects={currentPageObjects}
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
        />

        <div className="sidebar-right">
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
          <EvidencePanel
            markers={evidenceIndex.markers}
            exhibits={evidenceIndex.exhibits}
            onJumpToPage={setCurrentPage}
            onExportBundle={handleExportEvidenceBundle}
          />
          <CaseGraph
            graph={caseGraph}
            onNavigate={setCurrentPage}
          />
          <AvaPanel onAsk={handleAskAva} />
        </div>
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
    </div>
      )}
    </>
  );
}

export default App;
