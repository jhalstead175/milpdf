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
import useHistory from './hooks/useHistory';
import {
  loadPdf, deletePage, reorderPages, rotatePage,
  addBlankPage, mergePdf, insertPdf, imagesToPdf, embedEditorObjects, cropPage,
  saveWithDialog, downloadBlob, addWatermark, splitPdf, printPdf,
} from './utils/pdfUtils';
import { detectFormFields } from './utils/formDetection';
import { convertPdfToWord } from './utils/wordExport';
import { copyObjects, pasteObjects, duplicateObjects } from './editor/clipboard';
import { scanForPii } from './veteran/autoRedact';
import { parseDD214 } from './veteran/dd214Parser';
import { loadProfile, saveProfile, normalizeProfile } from './veteran/profile';
import { FORM_PROFILES, detectFormProfile, autofillScene } from './veteran/formProfiles';
import {
  alignLeft, alignRight, alignTop, alignBottom,
  alignCenterH, alignCenterV,
  distributeHorizontally, distributeVertically,
} from './editor/alignment';
import { bringForward, sendBackward, bringToFront, sendToBack } from './editor/zorder';
import './App.css';

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

function App() {
  const [view, setView] = useState(isElectron ? 'editor' : 'landing');

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
  const [zoom, setZoom] = useState(1.0);
  const [activeTool, setActiveTool] = useState('select');
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [watermarkText, setWatermarkText] = useState('');
  const [fileName, setFileName] = useState('document.pdf');
  const [loading, setLoading] = useState(false);
  const [selectionIds, setSelectionIds] = useState([]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [, setActiveWorkflow] = useState(null);
  const [profile, setProfile] = useState(() => loadProfile());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [formProfileKey, setFormProfileKey] = useState(null);

  const annHistory = useHistory([]);
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

  const updateFromResult = useCallback((result) => {
    setPdfDoc(result.pdfDoc);
    setPdfBytes(result.bytes);
    setRenderDoc(result.renderDoc);
    setNumPages(result.pdfDoc.getPageCount());
  }, []);

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
      annHistory.clear(formFields);
      setSelectionIds([]);
      const fieldNames = formFields.map(f => f.fieldName).filter(Boolean);
      setFormProfileKey(detectFormProfile(fieldNames));
      setActiveTool('select');
    } catch (err) {
      alert('Failed to load PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [updateFromResult, annHistory]);

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
        annHistory.set([]);
        setSelectionIds([]);
        setFormProfileKey(null);
        setView('editor');
      } catch (err) {
        alert('Failed to convert images: ' + err.message);
      }
    });
  }, [loadFromBuffer, annHistory]);

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
      if (annHistory.state.length > 0) {
        bytes = await embedEditorObjects(bytes, annHistory.state, layers, { flattenForm: true });
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
  }, [pdfBytes, annHistory.state, fileName, watermarkText, layers]);

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
      annHistory.set(prev =>
        prev
          .filter(a => a.page !== currentPage)
          .map(a => a.page > currentPage ? { ...a, page: a.page - 1 } : a)
      );
    } catch (err) {
      alert('Failed to delete page: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, currentPage, numPages, updateFromResult, annHistory]);

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
      annHistory.set(prev => prev.map(a => {
        const oldPageIndex = a.page - 1;
        const newPos = order.indexOf(oldPageIndex);
        return { ...a, page: newPos + 1 };
      }));
    } catch (err) {
      alert('Failed to reorder pages: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, numPages, updateFromResult, annHistory]);

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
      if (annHistory.state.length > 0) {
        bytes = await embedEditorObjects(bytes, annHistory.state, layers, { flattenForm: true });
      }
      if (watermarkText) {
        bytes = await addWatermark(bytes, watermarkText);
      }
      printPdf(bytes);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, annHistory.state, watermarkText, layers]);

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
      annHistory.set([]);
      setSelectionIds([]);
      setFormProfileKey(null);
    } catch (err) {
      alert('Failed to convert images: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }, [annHistory]);

  // --- Annotations ---
  const handleAddAnnotation = useCallback((annotation) => {
    annHistory.set(prev => [...prev, annotation]);
  }, [annHistory]);

  const handleAddObjects = useCallback((newObjects) => {
    if (!newObjects || newObjects.length === 0) return;
    annHistory.set(prev => [...prev, ...newObjects]);
  }, [annHistory]);

  const handleDeleteAnnotation = useCallback((id) => {
    annHistory.set(prev => prev.filter(a => a.id !== id));
  }, [annHistory]);

  const handleUpdateAnnotation = useCallback((id, updates) => {
    annHistory.set(prev =>
      prev.map(a => a.id === id ? { ...a, ...updates } : a)
    );
  }, [annHistory]);

  const handleBatchUpdateObjects = useCallback((patches) => {
    if (!patches || patches.length === 0) return;
    const patchMap = new Map(patches.map(p => [p.id, p]));
    annHistory.set(prev =>
      prev.map(obj => patchMap.has(obj.id) ? { ...obj, ...patchMap.get(obj.id) } : obj)
    );
  }, [annHistory]);

  useEffect(() => {
    setSelectionIds(prev => prev.filter(id => annHistory.state.some(o => o.id === id)));
  }, [annHistory.state]);

  const selectedSet = useMemo(() => new Set(selectionIds), [selectionIds]);
  const selectedObjects = useMemo(
    () => annHistory.state.filter(o => selectedSet.has(o.id)),
    [annHistory.state, selectedSet]
  );
  const activeFormProfile = useMemo(
    () => (formProfileKey ? FORM_PROFILES[formProfileKey] : null),
    [formProfileKey]
  );

  const handleCopy = useCallback(() => {
    copyObjects(annHistory.state, selectedSet);
  }, [annHistory.state, selectedSet]);

  const handlePaste = useCallback(() => {
    const pasted = pasteObjects(currentPage);
    handleAddObjects(pasted);
    setSelectionIds(pasted.map(o => o.id));
  }, [currentPage, handleAddObjects]);

  const handleDuplicate = useCallback(() => {
    const duplicated = duplicateObjects(annHistory.state, selectedSet);
    handleAddObjects(duplicated);
    setSelectionIds(duplicated.map(o => o.id));
  }, [annHistory.state, selectedSet, handleAddObjects]);

  const handleProfileSave = useCallback((nextProfile) => {
    const normalized = saveProfile(nextProfile);
    setProfile(normalized);
    setShowProfileModal(false);
  }, []);

  const handleAutoFill = useCallback(() => {
    if (!activeFormProfile) return;
    const filled = autofillScene(annHistory.state, profile, activeFormProfile);
    annHistory.set(filled);
  }, [activeFormProfile, annHistory, profile]);

  const handleAlignment = useCallback((type) => {
    if (selectedSet.size < 2) return;
    let patches = [];
    if (type === 'left') patches = alignLeft(annHistory.state, selectedSet);
    else if (type === 'right') patches = alignRight(annHistory.state, selectedSet);
    else if (type === 'top') patches = alignTop(annHistory.state, selectedSet);
    else if (type === 'bottom') patches = alignBottom(annHistory.state, selectedSet);
    else if (type === 'centerH') patches = alignCenterH(annHistory.state, selectedSet);
    else if (type === 'centerV') patches = alignCenterV(annHistory.state, selectedSet);
    else if (type === 'distributeH') patches = distributeHorizontally(annHistory.state, selectedSet);
    else if (type === 'distributeV') patches = distributeVertically(annHistory.state, selectedSet);
    handleBatchUpdateObjects(patches);
  }, [annHistory.state, selectedSet, handleBatchUpdateObjects]);

  const handleZOrder = useCallback((type) => {
    if (selectionIds.length === 0) return;
    const id = selectionIds[0];
    let patches = [];
    if (type === 'forward') patches = bringForward(annHistory.state, id);
    else if (type === 'backward') patches = sendBackward(annHistory.state, id);
    else if (type === 'front') patches = bringToFront(annHistory.state, id);
    else if (type === 'back') patches = sendToBack(annHistory.state, id);
    handleBatchUpdateObjects(patches);
  }, [annHistory.state, selectionIds, handleBatchUpdateObjects]);

  const commandContext = useMemo(() => ({
    hasDoc: !!renderDoc,
    setActiveTool,
    handleOpen,
    handleSave,
    handleMerge,
    handleSplit,
    handleRotate,
    handleAddBlank,
    handleDeletePage,
    handlePrint,
    handleExportWord,
    setShowSignaturePad,
    signatureDataUrl,
    setZoom,
    fitZoom: () => setZoom(1.0),
    setActiveWorkflow,
    runDD214Analysis,
    runAutoRedact,
    applyAlignment: handleAlignment,
    applyZOrder: handleZOrder,
    handleCopy,
    handlePaste,
    handleDuplicate,
    openProfile: () => setShowProfileModal(true),
    autoFillProfile: handleAutoFill,
  }), [renderDoc, setActiveTool, handleOpen, handleSave, handleMerge, handleSplit, handleRotate,
    handleAddBlank, handleDeletePage, handlePrint, handleExportWord, signatureDataUrl, setZoom,
    setActiveWorkflow, runDD214Analysis, runAutoRedact, handleAlignment, handleZOrder,
    handleCopy, handlePaste, handleDuplicate, handleAutoFill, setShowProfileModal]);

  // --- Signature ---
  const handleSignatureSave = useCallback((dataUrl) => {
    setSignatureDataUrl(dataUrl);
    setShowSignaturePad(false);
    setActiveTool('signature');
  }, []);

  const handleToolChange = useCallback((tool) => {
    if (tool === 'signature' && !signatureDataUrl) {
      setShowSignaturePad(true);
      return;
    }
    setActiveTool(tool);
  }, [signatureDataUrl]);

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
  }, [pdfDoc, currentPage, updateFromResult]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      const inInput = !!e.target.closest('input,textarea,select');

      if (isMod && e.key === 'o') { e.preventDefault(); handleOpen(); }
      else if (isMod && e.key === 's') { e.preventDefault(); handleSave(); }
      else if (isMod && e.key === 'p') { e.preventDefault(); handlePrint(); }
      else if (isMod && e.key === 'k') { e.preventDefault(); setShowCommandPalette(p => !p); }
      else if (isMod && e.key === 'c' && !inInput) { e.preventDefault(); handleCopy(); }
      else if (isMod && e.key === 'v' && !inInput) { e.preventDefault(); handlePaste(); }
      else if (isMod && e.key === 'd' && !inInput) { e.preventDefault(); handleDuplicate(); }
      else if (isMod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); annHistory.undo(); }
      else if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); annHistory.redo(); }
      else if (e.key === 'ArrowLeft' && !inInput && selectionIds.length === 0) {
        setCurrentPage(p => Math.max(1, p - 1));
      }
      else if (e.key === 'ArrowRight' && !inInput && selectionIds.length === 0) {
        setCurrentPage(p => Math.min(numPages, p + 1));
      }
      else if (e.key === 'Delete' && !inInput && renderDoc) { handleDeletePage(); }
      else if (e.key === '+' && isMod) { e.preventDefault(); setZoom(z => Math.min(3, z + 0.25)); }
      else if (e.key === '-' && isMod) { e.preventDefault(); setZoom(z => Math.max(0.25, z - 0.25)); }

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
  }, [handleOpen, handleSave, handlePrint, handleDeletePage, handleCopy, handlePaste,
    handleDuplicate, annHistory, numPages, renderDoc, activeTool, selectionIds, selectedObjects,
    handleBatchUpdateObjects]);

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
        onOpen={handleOpen}
        onSave={handleSave}
        onMerge={handleMerge}
        onAddBlank={handleAddBlank}
        onDeletePage={handleDeletePage}
        onRotatePage={handleRotate}
        activeTool={activeTool}
        onToolChange={handleToolChange}
        onExportWord={handleExportWord}
        zoom={zoom}
        onZoomChange={setZoom}
        hasDoc={!!renderDoc}
        currentPage={currentPage}
        numPages={numPages}
        onPageChange={setCurrentPage}
        onUndo={annHistory.undo}
        onRedo={annHistory.redo}
        canUndo={annHistory.canUndo}
        canRedo={annHistory.canRedo}
        onPrint={handlePrint}
        onWatermark={handleWatermark}
        watermarkText={watermarkText}
        onSplit={handleSplit}
        onImagesToPdf={handleImagesToPdf}
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
          objects={annHistory.state}
          layers={layers}
          selectionIds={selectionIds}
          onSelectionChange={setSelectionIds}
          onAddObject={handleAddAnnotation}
          onDeleteObject={handleDeleteAnnotation}
          onUpdateObject={handleUpdateAnnotation}
          onBatchUpdateObjects={handleBatchUpdateObjects}
          signatureDataUrl={signatureDataUrl}
          onRequestSignature={() => setShowSignaturePad(true)}
          onCropApply={handleCropApply}
          onCropCancel={() => setActiveTool('select')}
          onDropFile={loadFile}
          watermarkText={watermarkText}
        />
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
        context={commandContext}
      />

      {showProfileModal && (
        <ProfileModal
          profile={profile}
          onSave={handleProfileSave}
          onClose={() => setShowProfileModal(false)}
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
