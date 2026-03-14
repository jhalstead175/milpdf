import {
  FolderOpen, Save, Printer, Undo2, Redo2, FilePlus, Trash2,
  RotateCw, FileStack, Scissors, MousePointer2, Type, Highlighter,
  Pencil, PenTool, ShieldOff, Crop, Droplets, FileText,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PenLine, ImagePlus,
  ChevronsUp, ChevronsDown, ArrowUp, ArrowDown,
} from 'lucide-react';

const IC = { size: 15, strokeWidth: 1.8 };

export default function Toolbar({
  runCommand,
  activeTool, hasDoc,
  zoom, currentPage, numPages,
  canUndo, canRedo, canZOrder,
  watermarkText,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">MilPDF</div>

      <div className="toolbar-section">
        <span className="toolbar-label">File</span>
        <div className="toolbar-group">
          <button onClick={() => runCommand('file.open')} title="Open PDF (Ctrl+O)">
            <FolderOpen {...IC} /> Open
          </button>
          <button onClick={() => runCommand('file.save')} disabled={!hasDoc} title="Save PDF (Ctrl+S)">
            <Save {...IC} /> Save
          </button>
          <button onClick={() => runCommand('file.print')} disabled={!hasDoc} title="Print (Ctrl+P)">
            <Printer {...IC} /> Print
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <span className="toolbar-label">Edit</span>
        <div className="toolbar-group">
          <button onClick={() => runCommand('edit.undo')} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 {...IC} />
          </button>
          <button onClick={() => runCommand('edit.redo')} disabled={!canRedo} title="Redo (Ctrl+Y)">
            <Redo2 {...IC} />
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <span className="toolbar-label">Pages</span>
        <div className="toolbar-group">
          <button onClick={() => runCommand('page.insert')} disabled={!hasDoc} title="Insert Blank Page">
            <FilePlus {...IC} /> Insert
          </button>
          <button onClick={() => runCommand('page.delete')} disabled={!hasDoc || numPages <= 1} title="Delete Current Page (Del)">
            <Trash2 {...IC} />
          </button>
          <button onClick={() => runCommand('page.rotate')} disabled={!hasDoc} title="Rotate Page 90 deg">
            <RotateCw {...IC} />
          </button>
          <button onClick={() => runCommand('file.merge')} disabled={!hasDoc} title="Merge another PDF">
            <FileStack {...IC} /> Merge
          </button>
          <button onClick={() => runCommand('file.split')} disabled={!hasDoc || numPages <= 1} title="Split/extract pages">
            <Scissors {...IC} /> Split
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <span className="toolbar-label">Annotate</span>
        <div className="toolbar-group">
          <ToolBtn commandId="tool.select" toolName="select" Icon={MousePointer2} label="Select" activeTool={activeTool} runCommand={runCommand} hasDoc={hasDoc} />
          <ToolBtn commandId="tool.text" toolName="text" Icon={Type} label="Text" activeTool={activeTool} runCommand={runCommand} hasDoc={hasDoc} />
          <ToolBtn commandId="tool.highlight" toolName="highlight" Icon={Highlighter} label="Highlight" activeTool={activeTool} runCommand={runCommand} hasDoc={hasDoc} />
          <ToolBtn commandId="tool.draw" toolName="draw" Icon={Pencil} label="Draw" activeTool={activeTool} runCommand={runCommand} hasDoc={hasDoc} />
          <ToolBtn commandId="tool.signature" toolName="signature" Icon={PenTool} label="Sign" activeTool={activeTool} runCommand={runCommand} hasDoc={hasDoc} />
          <ToolBtn commandId="tool.redact" toolName="redact" Icon={ShieldOff} label="Redact" activeTool={activeTool} runCommand={runCommand} hasDoc={hasDoc} />
          <ToolBtn commandId="tool.crop" toolName="crop" Icon={Crop} label="Crop" activeTool={activeTool} runCommand={runCommand} hasDoc={hasDoc} />
          <ToolBtn commandId="tool.edit" toolName="edit" Icon={PenLine} label="Edit" activeTool={activeTool} runCommand={runCommand} hasDoc={hasDoc} />
        </div>
      </div>

      <div className="toolbar-section">
        <span className="toolbar-label">Arrange</span>
        <div className="toolbar-group">
          <button onClick={() => runCommand('arrange.front')} disabled={!hasDoc || !canZOrder} title="Bring to front">
            <ChevronsUp {...IC} />
          </button>
          <button onClick={() => runCommand('arrange.forward')} disabled={!hasDoc || !canZOrder} title="Bring forward">
            <ArrowUp {...IC} />
          </button>
          <button onClick={() => runCommand('arrange.backward')} disabled={!hasDoc || !canZOrder} title="Send backward">
            <ArrowDown {...IC} />
          </button>
          <button onClick={() => runCommand('arrange.back')} disabled={!hasDoc || !canZOrder} title="Send to back">
            <ChevronsDown {...IC} />
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <span className="toolbar-label">Export</span>
        <div className="toolbar-group">
          <button className={watermarkText ? 'active' : ''} onClick={() => runCommand('export.watermark')} disabled={!hasDoc} title={watermarkText ? 'Remove watermark' : 'Add watermark to all pages'}>
            <Droplets {...IC} /> {watermarkText ? 'Remove WM' : 'Watermark'}
          </button>
          <button onClick={() => runCommand('export.word')} disabled={!hasDoc} title="Export to Word (.docx)">
            <FileText {...IC} /> Word
          </button>
          <button onClick={() => runCommand('export.images')} title="Convert images to PDF">
            <ImagePlus {...IC} /> Images
          </button>
        </div>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-section">
        <span className="toolbar-label">View</span>
        <div className="toolbar-group zoom-controls">
          <button onClick={() => runCommand('view.zoom.out')} disabled={!hasDoc || zoom <= 0.25}>
            <ZoomOut {...IC} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button onClick={() => runCommand('view.zoom.in')} disabled={!hasDoc || zoom >= 3}>
            <ZoomIn {...IC} />
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <span className="toolbar-label">Navigate</span>
        <div className="toolbar-group page-nav">
          <button onClick={() => runCommand('page.prev')} disabled={!hasDoc || currentPage <= 1}>
            <ChevronLeft {...IC} />
          </button>
          <span className="page-label">{hasDoc ? `${currentPage} / ${numPages}` : '--'}</span>
          <button onClick={() => runCommand('page.next')} disabled={!hasDoc || currentPage >= numPages}>
            <ChevronRight {...IC} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolBtn(props) {
  const { commandId, toolName, label, activeTool, runCommand, hasDoc } = props;
  const IconComp = props.Icon;
  return (
    <button
      className={activeTool === toolName ? 'active' : ''}
      onClick={() => runCommand(commandId)}
      disabled={!hasDoc}
      title={label}
    >
      <IconComp {...IC} /> {label}
    </button>
  );
}
