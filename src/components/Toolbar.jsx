import React from 'react';
import {
  FolderOpen, Save, Printer, Undo2, Redo2, FilePlus, Trash2,
  RotateCw, FileStack, Scissors, MousePointer2, Type, Highlighter,
  Pencil, PenTool, ShieldOff, Crop, Droplets, FileText,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PenLine, ImagePlus,
  ChevronsUp, ChevronsDown, ArrowUp, ArrowDown, ChevronDown,
} from 'lucide-react';

const IC = { size: 15, strokeWidth: 1.8 };

export default function Toolbar({
  runCommand,
  activeTool, hasDoc,
  zoom, currentPage, numPages,
  canUndo, canRedo, canZOrder,
  watermarkText,
  isV3,
  onToggleV3,
}) {
  const toolbarRef = React.useRef(null);
  const [openMenu, setOpenMenu] = React.useState(null);

  const quickButtons = [
    { id: 'file.open', label: 'Open', icon: FolderOpen, disabled: false },
    { id: 'file.save', label: 'Save', icon: Save, disabled: !hasDoc },
    { id: 'edit.undo', label: 'Undo', icon: Undo2, disabled: !canUndo },
    { id: 'edit.redo', label: 'Redo', icon: Redo2, disabled: !canRedo },
    { id: 'tool.select', label: 'Select', icon: MousePointer2, disabled: !hasDoc, active: activeTool === 'select' },
  ];

  const menus = [
    {
      id: 'file',
      label: 'File',
      items: [
        { groupLabel: 'Document' },
        { id: 'file.open', label: 'Open PDF', subLabel: 'Load a document', icon: FolderOpen, disabled: false },
        { id: 'file.save', label: 'Save PDF', subLabel: 'Export annotations', icon: Save, disabled: !hasDoc },
        { id: 'file.print', label: 'Print', subLabel: 'Send to printer', icon: Printer, disabled: !hasDoc },
        { groupLabel: 'Assets' },
        { id: 'file.importImages', label: 'Import Images', subLabel: 'Place on page', icon: ImagePlus, disabled: !hasDoc },
      ],
    },
    {
      id: 'pages',
      label: 'Pages',
      items: [
        { groupLabel: 'Page Actions' },
        { id: 'page.insert', label: 'Insert Blank', subLabel: 'Add a page', icon: FilePlus, disabled: !hasDoc },
        { id: 'page.delete', label: 'Delete Page', subLabel: 'Remove current', icon: Trash2, disabled: !hasDoc || numPages <= 1 },
        { id: 'page.rotate', label: 'Rotate 90°', subLabel: 'Rotate current', icon: RotateCw, disabled: !hasDoc },
        { groupLabel: 'Document Ops' },
        { id: 'file.merge', label: 'Merge PDF', subLabel: 'Combine files', icon: FileStack, disabled: !hasDoc },
        { id: 'file.split', label: 'Split / Extract', subLabel: 'New PDF from pages', icon: Scissors, disabled: !hasDoc || numPages <= 1 },
      ],
    },
    {
      id: 'annotate',
      label: 'Annotate',
      items: [
        { groupLabel: 'Basics' },
        { id: 'tool.select', label: 'Select', subLabel: 'Move & resize', icon: MousePointer2, disabled: !hasDoc },
        { id: 'tool.text', label: 'Text', subLabel: 'Add text box', icon: Type, disabled: !hasDoc },
        { id: 'tool.draw', label: 'Draw', subLabel: 'Freehand ink', icon: Pencil, disabled: !hasDoc },
        { groupLabel: 'Markup' },
        { id: 'tool.highlight', label: 'Highlight', subLabel: 'Mark text', icon: Highlighter, disabled: !hasDoc },
        { id: 'tool.redact', label: 'Redact', subLabel: 'Black out', icon: ShieldOff, disabled: !hasDoc },
        { id: 'tool.edit', label: 'Edit', subLabel: 'Whiteout & replace', icon: PenLine, disabled: !hasDoc },
        { groupLabel: 'Signature' },
        { id: 'tool.signature', label: 'Sign', subLabel: 'Place signature', icon: PenTool, disabled: !hasDoc },
        { groupLabel: 'Layout' },
        { id: 'tool.crop', label: 'Crop', subLabel: 'Trim page view', icon: Crop, disabled: !hasDoc },
      ],
    },
    {
      id: 'arrange',
      label: 'Arrange',
      items: [
        { groupLabel: 'Z-Order' },
        { id: 'arrange.front', label: 'Bring to Front', subLabel: 'Top of stack', icon: ChevronsUp, disabled: !hasDoc || !canZOrder },
        { id: 'arrange.forward', label: 'Bring Forward', subLabel: 'One step up', icon: ArrowUp, disabled: !hasDoc || !canZOrder },
        { id: 'arrange.backward', label: 'Send Backward', subLabel: 'One step down', icon: ArrowDown, disabled: !hasDoc || !canZOrder },
        { id: 'arrange.back', label: 'Send to Back', subLabel: 'Bottom of stack', icon: ChevronsDown, disabled: !hasDoc || !canZOrder },
      ],
    },
    {
      id: 'layout',
      label: 'Layout',
      items: [
        { id: 'export.watermark', label: watermarkText ? 'Remove Watermark' : 'Add Watermark', icon: Droplets, disabled: !hasDoc },
      ],
    },
    {
      id: 'export',
      label: 'Export',
      items: [
        { groupLabel: 'Formats' },
        { id: 'export.word', label: 'Export to Word', subLabel: 'Save as DOCX', icon: FileText, disabled: !hasDoc },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { id: 'view.zoom.out', label: 'Zoom Out', subLabel: 'Decrease zoom', icon: ZoomOut, disabled: !hasDoc || zoom <= 0.25 },
        { id: 'view.zoom.in', label: 'Zoom In', subLabel: 'Increase zoom', icon: ZoomIn, disabled: !hasDoc || zoom >= 3 },
      ],
    },
  ];

  const toggleMenu = (id) => {
    setOpenMenu(prev => (prev === id ? null : id));
  };

  React.useEffect(() => {
    const handler = (e) => {
      if (!toolbarRef.current?.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="toolbar" ref={toolbarRef}>
      <div className="toolbar-brand">MilPDF</div>

      <div className="toolbar-quick">
        {quickButtons.map(btn => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              className={btn.active ? 'active' : ''}
              onClick={() => runCommand(btn.id)}
              disabled={btn.disabled}
              title={btn.label}
            >
              <Icon {...IC} />
            </button>
          );
        })}
      </div>

      <div className="toolbar-menus">
        {menus.map(menu => (
          <div key={menu.id} className="toolbar-menu">
            <button
              className={`toolbar-menu-trigger ${openMenu === menu.id ? 'open' : ''}`}
              onClick={() => toggleMenu(menu.id)}
            >
              {menu.label} <ChevronDown size={14} />
            </button>
            {openMenu === menu.id && (
              <div className={`toolbar-menu-card ${menu.items.length > 6 ? 'toolbar-menu-card--grid' : ''}`}>
                {menu.items.map(item => {
                  if (item.groupLabel) {
                    return (
                      <div key={item.groupLabel} className="toolbar-menu-group-label">
                        {item.groupLabel}
                      </div>
                    );
                  }
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      className="toolbar-menu-item"
                      onClick={() => {
                        runCommand(item.id);
                        setOpenMenu(null);
                      }}
                      disabled={item.disabled}
                    >
                      <Icon {...IC} />
                      <span className="toolbar-menu-text">
                        <span>{item.label}</span>
                        {item.subLabel && <small>{item.subLabel}</small>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-status">
        <div className="toolbar-zoom">
          <button onClick={() => runCommand('view.zoom.out')} disabled={!hasDoc || zoom <= 0.25}>
            <ZoomOut {...IC} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button onClick={() => runCommand('view.zoom.in')} disabled={!hasDoc || zoom >= 3}>
            <ZoomIn {...IC} />
          </button>
        </div>
        <div className="toolbar-page">
          <button onClick={() => runCommand('page.prev')} disabled={!hasDoc || currentPage <= 1}>
            <ChevronLeft {...IC} />
          </button>
          <span className="page-label">{hasDoc ? `${currentPage} / ${numPages}` : '--'}</span>
          <button onClick={() => runCommand('page.next')} disabled={!hasDoc || currentPage >= numPages}>
            <ChevronRight {...IC} />
          </button>
        </div>
        <button className="toolbar-mode" onClick={onToggleV3} title="Toggle v3 shell preview">
          {isV3 ? 'Editor' : 'V3 Shell'}
        </button>
      </div>
    </div>
  );
}
