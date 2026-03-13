import { useState, useCallback, useRef, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import './components/LandingPage.css';
import Toolbar from './components/Toolbar';
import PageThumbnails from './components/PageThumbnails';
import PDFViewer from './components/PDFViewer';
import SignaturePad from './components/SignaturePad';
import useHistory from './hooks/useHistory';
import {
  loadPdf, deletePage, reorderPages, rotatePage,
  addBlankPage, mergePdf, insertPdf, imagesToPdf,
  embedAnnotations, embedEditorObjects, cropPage,
  saveWithDialog, downloadBlob, addWatermark, splitPdf, printPdf,
} from './utils/pdfUtils';
import { isLegacyFormat } from './editor/EditorObject.js';
import { convertPdfToWord } from './utils/wordExport';
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

  // Scene graph: flat array of EditorObjects (MilPDF 2.0 format)
  // useHistory snapshots the entire array for undo/redo — same mechanism as before.
  const annHistory = useHistory([]);

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
      annHistory.clear([]);
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

  // Choose correct embed function based on object format
  const embedObjects = useCallback(async (bytes, objects) => {
    if (objects.length === 0) return bytes;
    if (isLegacyFormat(objects)) {
      return embedAnnotations(bytes, objects);
    }
    return embedEditorObjects(bytes, objects);
  }, []);

  const handleSave = useCallback(async () => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      let bytes = pdfBytes;
      if (annHistory.state.length > 0) {
        bytes = await embedObjects(bytes, annHistory.state);
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
  }, [pdfBytes, annHistory.state, fileName, watermarkText, embedObjects]);

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
          .filter(a => (a.page ?? a.pageNum) !== currentPage)
          .map(a => {
            const pg = a.page ?? a.pageNum;
            if (pg <= currentPage) return a;
            return 'page' in a ? { ...a, page: pg - 1 } : { ...a, pageNum: pg - 1 };
          })
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
        const oldPageIndex = (a.page ?? a.pageNum) - 1;
        const newPos = order.indexOf(oldPageIndex);
        return 'page' in a
          ? { ...a, page: newPos + 1 }
          : { ...a, pageNum: newPos + 1 };
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
        bytes = await embedObjects(bytes, annHistory.state);
      }
      if (watermarkText) {
        bytes = await addWatermark(bytes, watermarkText);
      }
      printPdf(bytes);
    } finally {
      setLoading(false);
    }
  }, [pdfBytes, annHistory.state, watermarkText, embedObjects]);

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
    } catch (err) {
      alert('Failed to convert images: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }, [annHistory]);

  // --- EditorObject scene graph CRUD (also handles legacy annotations) ---
  const handleAddObject = useCallback((obj) => {
    annHistory.set(prev => [...prev, obj]);
  }, [annHistory]);

  const handleDeleteObject = useCallback((id) => {
    annHistory.set(prev => prev.filter(a => a.id !== id));
  }, [annHistory]);

  const handleUpdateObject = useCallback((id, updates) => {
    annHistory.set(prev =>
      prev.map(a => a.id === id ? { ...a, ...updates } : a)
    );
  }, [annHistory]);

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
      if (isMod && e.key === 'o') { e.preventDefault(); handleOpen(); }
      else if (isMod && e.key === 's') { e.preventDefault(); handleSave(); }
      else if (isMod && e.key === 'p') { e.preventDefault(); handlePrint(); }
      else if (isMod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); annHistory.undo(); }
      else if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); annHistory.redo(); }
      else if (e.key === 'ArrowLeft' && !e.target.closest('input')) { setCurrentPage(p => Math.max(1, p - 1)); }
      else if (e.key === 'ArrowRight' && !e.target.closest('input')) { setCurrentPage(p => Math.min(numPages, p + 1)); }
      else if (e.key === 'Delete' && !e.target.closest('input') && renderDoc) { handleDeletePage(); }
      else if (e.key === '+' && isMod) { e.preventDefault(); setZoom(z => Math.min(3, z + 0.25)); }
      else if (e.key === '-' && isMod) { e.preventDefault(); setZoom(z => Math.max(0.25, z - 0.25)); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleOpen, handleSave, handlePrint, handleDeletePage, annHistory, numPages, renderDoc]);

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

      <div className="main-content">
        <PageThumbnails
          renderDoc={renderDoc}
          numPages={numPages}
          currentPage={currentPage}
          onPageSelect={setCurrentPage}
          onReorder={handleReorder}
        />

        <PDFViewer
          renderDoc={renderDoc}
          currentPage={currentPage}
          zoom={zoom}
          activeTool={activeTool}
          objects={annHistory.state}
          onAddObject={handleAddObject}
          onDeleteObject={handleDeleteObject}
          onUpdateObject={handleUpdateObject}
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
