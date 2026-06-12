import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Trash2, PenLine } from 'lucide-react';

export default function SignaturePad({ savedSignature, onSave, onUse, onRemove, onClose }) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

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

  const save = useCallback(() => {
    if (!hasDrawn) return;
    onSave(canvasRef.current.toDataURL('image/png'));
  }, [hasDrawn, onSave]);

  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        setHasDrawn(true);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

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

        <p className="modal-hint">
          {savedSignature ? 'Or create a new signature:' : 'Draw below, or upload an existing signature image — it will be saved for next time.'}
        </p>
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
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            <Upload size={15} strokeWidth={1.8} /> Upload
          </button>
          <button onClick={clear} className="btn-secondary">Clear</button>
          <button onClick={save} disabled={!hasDrawn} className="btn-primary">
            {savedSignature ? 'Save & Replace' : 'Save & Use'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>
    </div>
  );
}
