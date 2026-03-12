import {
  FolderOpen, Save, Printer, Undo2, Redo2, FilePlus, Trash2,
  RotateCw, FileStack, Scissors, MousePointer2, Type, Highlighter,
  Pencil, PenTool, ShieldOff, Crop, Droplets, FileText,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PenLine, ImagePlus,
} from 'lucide-react';

const IC = { size: 15, strokeWidth: 1.8 };

export default function Toolbar({
  onOpen, onSave, onMerge, onAddBlank, onDeletePage,
  onRotatePage, activeTool, onToolChange, onExportWord,
  zoom, onZoomChange, hasDoc, currentPage, numPages,
  onPageChange, onUndo, onRedo, canUndo, canRedo,
  onPrint, onWatermark, onSplit, onImagesToPdf, watermarkText,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">MilPDF</div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={onOpen} title="Open PDF (Ctrl+O)">
          <FolderOpen {...IC} /> Open
        </button>
        <button onClick={onSave} disabled={!hasDoc} title="Save PDF (Ctrl+S)">
          <Save {...IC} /> Save
        </button>
        <button onClick={onPrint} disabled={!hasDoc} title="Print (Ctrl+P)">
          <Printer {...IC} /> Print
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 {...IC} />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 {...IC} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={onAddBlank} disabled={!hasDoc} title="Insert Blank Page">
          <FilePlus {...IC} /> Insert
        </button>
        <button onClick={onDeletePage} disabled={!hasDoc || numPages <= 1} title="Delete Current Page (Del)">
          <Trash2 {...IC} />
        </button>
        <button onClick={() => onRotatePage(90)} disabled={!hasDoc} title="Rotate Page 90°">
          <RotateCw {...IC} />
        </button>
        <button onClick={onMerge} disabled={!hasDoc} title="Merge another PDF">
          <FileStack {...IC} /> Merge
        </button>
        <button onClick={onSplit} disabled={!hasDoc || numPages <= 1} title="Split/extract pages">
          <Scissors {...IC} /> Split
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolBtn name="select" Icon={MousePointer2} label="Select" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="text" Icon={Type} label="Text" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="highlight" Icon={Highlighter} label="Highlight" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="draw" Icon={Pencil} label="Draw" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="signature" Icon={PenTool} label="Sign" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="redact" Icon={ShieldOff} label="Redact" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="crop" Icon={Crop} label="Crop" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
        <ToolBtn name="edit" Icon={PenLine} label="Edit" activeTool={activeTool} onToolChange={onToolChange} hasDoc={hasDoc} />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className={watermarkText ? 'active' : ''} onClick={onWatermark} disabled={!hasDoc} title={watermarkText ? 'Remove watermark' : 'Add watermark to all pages'}>
          <Droplets {...IC} /> {watermarkText ? 'Remove WM' : 'Watermark'}
        </button>
        <button onClick={onExportWord} disabled={!hasDoc} title="Export to Word (.docx)">
          <FileText {...IC} /> Word
        </button>
        <button onClick={onImagesToPdf} title="Convert images to PDF">
          <ImagePlus {...IC} /> Images
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group zoom-controls">
        <button onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))} disabled={!hasDoc || zoom <= 0.25}>
          <ZoomOut {...IC} />
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button onClick={() => onZoomChange(Math.min(3, zoom + 0.25))} disabled={!hasDoc || zoom >= 3}>
          <ZoomIn {...IC} />
        </button>
      </div>

      <div className="toolbar-group page-nav">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={!hasDoc || currentPage <= 1}>
          <ChevronLeft {...IC} />
        </button>
        <span className="page-label">{hasDoc ? `${currentPage} / ${numPages}` : '–'}</span>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={!hasDoc || currentPage >= numPages}>
          <ChevronRight {...IC} />
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ name, Icon, label, activeTool, onToolChange, hasDoc }) {
  return (
    <button
      className={activeTool === name ? 'active' : ''}
      onClick={() => onToolChange(name)}
      disabled={!hasDoc}
      title={label}
    >
      <Icon {...IC} /> {label}
    </button>
  );
}
