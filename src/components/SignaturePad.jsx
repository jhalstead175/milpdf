import { useRef, useState, useCallback, useEffect } from 'react';
import { Trash2, PenLine, ImageIcon, UploadCloud } from 'lucide-react';

export default function SignaturePad({ savedSignature, onSave, onUse, onRemove, onClose }) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 500;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, [getPos]);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }, [isDrawing, getPos]);

  const stopDrawing = useCallback((e) => {
    if (e) e.preventDefault();
    setIsDrawing(false);
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasDrawn(false);
  }, []);

  const saveDrawing = useCallback(() => {
    if (!hasDrawn) return;
    onSave(canvasRef.current.toDataURL('image/png'));
  }, [hasDrawn, onSave]);

  const loadImageFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, GIF, etc.).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result);
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = useCallback((e) => {
    loadImageFile(e.target.files?.[0]);
    e.target.value = '';
  }, [loadImageFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    loadImageFile(e.dataTransfer.files?.[0]);
  }, [loadImageFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const saveUpload = useCallback(() => {
    if (uploadPreview) onSave(uploadPreview);
  }, [uploadPreview, onSave]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal signature-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Signature</h3>

        {savedSignature ? (
          <div className="signature-saved">
            <span className="signature-saved-label">Saved signature</span>
            <div className="signature-saved-preview">
              <img src={savedSignature} alt="Saved signature" />
            </div>
            <div className="signature-saved-actions">
              <button className="btn-primary" onClick={onUse}>
                <PenLine size={15} strokeWidth={1.8} /> Place on document
              </button>
              <button className="btn-secondary" onClick={onRemove}>
                <Trash2 size={15} strokeWidth={1.8} /> Remove
              </button>
            </div>
          </div>
        ) : null}

        <div className="sig-tabs">
          <button
            type="button"
            className={`sig-tab${mode === 'draw' ? ' active' : ''}`}
            onClick={() => setMode('draw')}
          >
            <PenLine size={14} strokeWidth={1.8} />
            Draw
          </button>
          <button
            type="button"
            className={`sig-tab${mode === 'upload' ? ' active' : ''}`}
            onClick={() => setMode('upload')}
          >
            <ImageIcon size={14} strokeWidth={1.8} />
            Upload Image
          </button>
        </div>

        {mode === 'draw' ? (
          <>
            <canvas
              ref={canvasRef}
              className="signature-canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="modal-actions">
              <button onClick={clear} className="btn-secondary">Clear</button>
              <button onClick={saveDrawing} disabled={!hasDrawn} className="btn-primary">
                {savedSignature ? 'Save & Replace' : 'Save & Use'}
              </button>
              <button onClick={onClose} className="btn-secondary">Cancel</button>
            </div>
          </>
        ) : (
          <>
            {uploadPreview ? (
              <div className="sig-upload-preview">
                <img src={uploadPreview} alt="Signature preview" />
                <button
                  type="button"
                  className="sig-upload-clear"
                  onClick={() => setUploadPreview(null)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                className={`sig-drop-zone${isDragOver ? ' drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={36} strokeWidth={1.4} className="sig-drop-icon" />
                <p className="sig-drop-label">Drop an image here</p>
                <p className="sig-drop-hint">or click to browse (PNG, JPG, GIF…)</p>
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse…
              </button>
              <button
                onClick={saveUpload}
                disabled={!uploadPreview}
                className="btn-primary"
              >
                {savedSignature ? 'Save & Replace' : 'Save & Use'}
              </button>
              <button onClick={onClose} className="btn-secondary">Cancel</button>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>
    </div>
  );
}
