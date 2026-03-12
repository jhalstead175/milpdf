export default function Toolbar({
  onOpen, onSave, onMerge, onAddBlank, onDeletePage,
  onRotatePage, activeTool, onToolChange, onExportWord,
  zoom, onZoomChange, hasDoc, currentPage, numPages,
  onPageChange, onUndo, onRedo, canUndo, canRedo,
  onPrint, onWatermark, onSplit,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">MilPDF</div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={onOpen} title="Open PDF (Ctrl+O)">
          <span className="tb-icon">📂</span> Open
        </button>
        <button onClick={onSave} disabled={!hasDoc} title="Save PDF (Ctrl+S)">
          <span className="tb-icon">💾</span> Save
        </button>
        <button onClick={onPrint} disabled={!hasDoc} title="Print (Ctrl+P)">
          <span className="tb-icon">🖨️</span> Print
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <span className="tb-icon">↩</span>
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <span className="tb-icon">↪</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={onAddBlank} disabled={!hasDoc} title="Add Blank Page">
          <span className="tb-icon">➕</span> Page
        </button>
        <button onClick={onDeletePage} disabled={!hasDoc || numPages <= 1} title="Delete Current Page (Del)">
          <span className="tb-icon">🗑️</span>
        </button>
        <button onClick={() => onRotatePage(90)} disabled={!hasDoc} title="Rotate Page 90°">
          <span className="tb-icon">↻</span>
        </button>
        <button onClick={onMerge} disabled={!hasDoc} title="Merge another PDF">
          <span className="tb-icon">📎</span> Merge
        </button>
        <button onClick={onSplit} disabled={!hasDoc || numPages <= 1} title="Split/extract pages">
          <span className="tb-icon">✂️</span> Split
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolBtn name="select" icon="👆" label="Select" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="text" icon="T" label="Text" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="highlight" icon="🖍️" label="Highlight" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="draw" icon="✏️" label="Draw" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="signature" icon="✍️" label="Sign" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="redact" icon="█" label="Redact" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="crop" icon="⬒" label="Crop" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={onWatermark} disabled={!hasDoc} title="Add watermark to all pages">
          <span className="tb-icon">💧</span> Watermark
        </button>
        <button onClick={onExportWord} disabled={!hasDoc} title="Export to Word (.docx)">
          <span className="tb-icon">📄</span> Word
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group zoom-controls">
        <button onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))} disabled={!hasDoc || zoom <= 0.25}>−</button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button onClick={() => onZoomChange(Math.min(3, zoom + 0.25))} disabled={!hasDoc || zoom >= 3}>+</button>
      </div>

      <div className="toolbar-group page-nav">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={!hasDoc || currentPage <= 1}>◀</button>
        <span className="page-label">{hasDoc ? `${currentPage} / ${numPages}` : '–'}</span>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={!hasDoc || currentPage >= numPages}>▶</button>
      </div>
    </div>
  );
}

function ToolBtn({ name, icon, label, activeTool, onToolChange, hasDoc }) {
  return (
    <button
      className={activeTool === name ? 'active' : ''}
      onClick={() => onToolChange(name)}
      disabled={!hasDoc}
      title={label}
    >
      <span className="tb-icon">{icon}</span> {label}
    </button>
  );
}
