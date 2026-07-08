import { useState, useCallback } from 'react';
import {
  MousePointer2, Highlighter, Pencil, Type, PenTool, Eraser, ShieldOff, SquarePen,
  PanelRightOpen, PanelLeftOpen, PanelLeftClose, ZoomIn, ZoomOut,
  Crop, Image as ImageIcon, Stamp, Undo2, RotateCw, Trash2,
} from 'lucide-react';
import LayersPanel from '../../components/LayersPanel';
import InspectorPanel from '../../components/InspectorPanel';
import PageThumbnails from '../../components/PageThumbnails';
import PDFViewer from '../../components/PDFViewer';
import EvidencePanel from '../../components/EvidencePanel';
import ContextInspector from '../panels/ContextInspector';
import AssistantDock from '../panels/AssistantDock';
import ContextMenu from '../../components/ContextMenu';

const REVIEW_TABS = [
  { id: 'selection', label: 'Current Tool' },
  { id: 'findings', label: 'Page Issues' },
  { id: 'pages', label: 'Page List' },
  { id: 'assistant', label: 'AI Review' },
];

// Grouped, icon-only tool rail. `action: 'import'` opens the image picker
// instead of switching the active canvas tool.
const TOOL_GROUPS = [
  [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'highlight', icon: Highlighter, label: 'Highlight' },
    { id: 'draw', icon: Pencil, label: 'Draw' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'textedit', icon: SquarePen, label: 'Edit Text' },
  ],
  [
    { id: 'note', icon: PenTool, label: 'Signature' },
    { id: 'image', icon: ImageIcon, label: 'Add Image', action: 'import' },
    { id: 'stamp', icon: Stamp, label: 'Stamp', action: 'stamp' },
  ],
  [
    { id: 'crop', icon: Crop, label: 'Crop Page' },
    { id: 'redact', icon: ShieldOff, label: 'Redact' },
    { id: 'eraser', icon: Eraser, label: 'Whiteout' },
  ],
];

const TOOL_ALIAS = { note: 'signature', eraser: 'edit' };

export default function ReviewWorkspace({
  renderDoc,
  pdfBytes,
  onTextEdit,
  pdfjsReady,
  numPages,
  currentPage,
  zoom,
  activeTool,
  currentPageMeta,
  currentPageObjects,
  selectionIds,
  selectedObjects,
  interactionState,
  setInteractionState,
  objects,
  layers,
  toolDefaults,
  activeToolConfig,
  activeFormProfile,
  watermarkText,
  imagePlacement,
  signatureDataUrl,
  evidenceIndex,
  pageAnnotations,
  reviewFindings = [],
  reviewPanelTab,
  onReviewPanelTabChange,
  inspectorCollapsed = false,
  onToggleInspector,
  toolRailCollapsed = false,
  onToggleToolRail,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onViewerWheel,
  onHandleOpen,
  onImportImages,
  onOpenStamp,
  onHandleToolChange,
  onHandleToolDefaultChange,
  onSetSelection,
  onToggleVisible,
  onToggleLocked,
  onLayerReorder,
  onUpdateObject,
  onDeleteObject,
  onSetActiveTool,
  onJumpToPage,
  onReorder,
  onDeletePageAt,
  onAddObject,
  onBatchUpdateObjects,
  onRequestSignature,
  onCropApply,
  onCropCancel,
  onDropFile,
  onImagePlaced,
  onImagePlacementCancel,
  onAskAva,
  onRunSuggestedAction,
  assistantDockProps = {},
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onDeleteSelected,
  onCopy,
  onPaste,
}) {
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y }
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);
  const handleCanvasContextMenu = useCallback((e) => {
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const ctxMenuItems = [
    { label: 'Undo', shortcut: 'Ctrl+Z', disabled: !canUndo, onClick: onUndo },
    { label: 'Redo', shortcut: 'Ctrl+Y', disabled: !canRedo, onClick: onRedo },
    { type: 'divider' },
    { label: 'Copy', shortcut: 'Ctrl+C', disabled: selectionIds.length === 0, onClick: onCopy },
    { label: 'Paste', shortcut: 'Ctrl+V', onClick: onPaste },
    { label: 'Delete', shortcut: 'Del', disabled: selectionIds.length === 0, onClick: onDeleteSelected },
    { type: 'divider' },
    { label: 'Deselect All', disabled: selectionIds.length === 0, onClick: () => onSetSelection([]) },
  ];

  const pageIssueCount = pageAnnotations.length + reviewFindings.length;
  const reviewTabs = REVIEW_TABS.map((tab) => {
    if (tab.id === 'selection') {
      return {
        ...tab,
        description: 'Adjust the active tool, selected object settings, and detected form helpers.',
        meta: activeToolConfig.title,
      };
    }
    if (tab.id === 'findings') {
      return {
        ...tab,
        description: 'Review page-level issues, annotations, and linked evidence references.',
        meta: `${pageIssueCount} open`,
      };
    }
    if (tab.id === 'pages') {
      return {
        ...tab,
        description: 'Scan pages, reorder the packet, and remove unnecessary pages.',
        meta: `${numPages || 0} pages`,
      };
    }
    return {
      ...tab,
      description: 'Run guided AI review actions and inspect recent AI output.',
      meta: renderDoc ? 'Document ready' : 'Awaiting document',
    };
  });

  let panelContent = null;

  if (reviewPanelTab === 'selection') {
    panelContent = (
      <>
        <div className="context-card">
          <div className="context-card-title">Active Tool</div>
          <div className="context-tool-name">{activeToolConfig.title}</div>
          {activeToolConfig.hint ? (
            <div className="context-tool-hint">{activeToolConfig.hint}</div>
          ) : null}
          {activeToolConfig.fields.length === 0 ? (
            activeToolConfig.hint ? null : <div className="context-muted">No adjustable options for this tool.</div>
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
                      onChange={(e) => onHandleToolDefaultChange(activeToolConfig.key, field.key, e.target.value)}
                    />
                  ) : (
                    <>
                      <input
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={value}
                        onChange={(e) => onHandleToolDefaultChange(
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
        {activeFormProfile ? (
          <div className="context-card">
            <div className="context-card-title">Detected Form</div>
            <div className="context-tool-name">{activeFormProfile.name}</div>
            <div className="context-summary">Auto-fill is available from the saved profile.</div>
          </div>
        ) : null}
        <LayersPanel
          objects={currentPageObjects}
          selectionIds={selectionIds}
          onSelectionChange={onSetSelection}
          onToggleVisible={onToggleVisible}
          onToggleLocked={onToggleLocked}
          onReorder={onLayerReorder}
        />
        <InspectorPanel
          selectedObjects={selectedObjects}
          onUpdateObject={onUpdateObject}
        />
      </>
    );
  } else if (reviewPanelTab === 'findings') {
    panelContent = (
      <>
        <div className="context-card">
          <div className="context-card-title">Current Page Issues</div>
          {pageAnnotations.length === 0 && reviewFindings.length === 0 ? (
            <div className="context-muted">No issues or annotations are staged on this page.</div>
          ) : (
            <div className="annotation-list">
              {reviewFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="annotation-list-item"
                >
                  <button
                    className="annotation-select"
                    onClick={() => onJumpToPage(finding.page || currentPage)}
                  >
                    <strong>{finding.typeLabel || finding.type}</strong>
                    <span>{finding.summary}</span>
                  </button>
                </div>
              ))}
              {pageAnnotations.map((obj) => (
                <div
                  key={obj.id}
                  className={`annotation-list-item ${selectionIds.includes(obj.id) ? 'selected' : ''}`}
                >
                  <button
                    className="annotation-select"
                    onClick={() => {
                      onSetSelection([obj.id]);
                      onSetActiveTool('select');
                    }}
                  >
                    <strong>{obj.type}</strong>
                    <span>{obj.name || obj.type}</span>
                  </button>
                  <button
                    className="annotation-delete-btn"
                    onClick={() => onDeleteObject(obj.id)}
                    title="Delete annotation"
                    aria-label="Delete annotation"
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
          onJumpToPage={onJumpToPage}
        />
      </>
    );
  } else if (reviewPanelTab === 'pages') {
    panelContent = (
      <PageThumbnails
        renderDoc={renderDoc}
        numPages={numPages}
        currentPage={currentPage}
        onPageSelect={onJumpToPage}
        onReorder={onReorder}
        onDeletePage={onDeletePageAt}
        showHeader={true}
      />
    );
  } else if (reviewPanelTab === 'assistant') {
    panelContent = (
      <AssistantDock
        onAsk={onAskAva}
        onRunSuggestedAction={onRunSuggestedAction}
        {...assistantDockProps}
      />
    );
  }

  return (
    <section className="review-workspace">
      <div className={`review-layout ${inspectorCollapsed ? 'inspector-collapsed' : ''} ${toolRailCollapsed ? 'tool-collapsed' : ''}`}>
        {toolRailCollapsed ? (
          <button
            type="button"
            className="review-tools-reopen"
            onClick={onToggleToolRail}
            title="Show tools"
            aria-label="Show tools"
          >
            <PanelLeftOpen size={16} />
            <span>Tools</span>
          </button>
        ) : (
          <div className="review-panel-left">
            <div className="tool-rail">
              {TOOL_GROUPS.map((group, groupIndex) => (
                <div className="tool-rail-group" key={`group-${groupIndex}`}>
                  {groupIndex > 0 ? <div className="tool-rail-divider" /> : null}
                  {group.map((item) => {
                    const mappedTool = TOOL_ALIAS[item.id] || item.id;
                    const isActive = activeTool === mappedTool;
                    const Icon = item.icon;
                    const handleClick = item.action === 'import'
                      ? () => onImportImages?.()
                      : item.action === 'stamp'
                        ? () => onOpenStamp?.()
                        : () => onHandleToolChange(mappedTool);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`tool-rail-button ${isActive ? 'active' : ''}`}
                        onClick={handleClick}
                        title={item.label}
                        aria-label={item.label}
                        disabled={!renderDoc || !pdfjsReady}
                      >
                        <Icon size={16} strokeWidth={1.9} />
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="tool-rail-spacer" />
              <button
                type="button"
                className="tool-rail-button"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <Undo2 size={16} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                className="tool-rail-button"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <RotateCw size={16} strokeWidth={1.9} />
              </button>
              {selectionIds.length > 0 ? (
                <button
                  type="button"
                  className="tool-rail-button tool-rail-danger"
                  onClick={onDeleteSelected}
                  title="Delete selected (Del)"
                  aria-label="Delete selected"
                >
                  <Trash2 size={16} strokeWidth={1.9} />
                </button>
              ) : null}
              <button
                type="button"
                className="tool-rail-button tool-rail-collapse"
                onClick={onToggleToolRail}
                title="Hide tools"
                aria-label="Hide tools"
              >
                <PanelLeftClose size={16} strokeWidth={1.9} />
              </button>
            </div>
          </div>
        )}

        <div className="review-canvas">
          <div className={`canvas-stage ${renderDoc ? '' : 'is-empty'}`}>
            <div className="canvas-scroll-container" onWheel={onViewerWheel}>
              <div className="canvas-stage-inner">
                <PDFViewer
                  renderDoc={renderDoc}
                  pdfBytes={pdfBytes}
                  onTextEdit={onTextEdit}
                  currentPage={currentPage}
                  zoom={zoom}
                  activeTool={activeTool}
                  objects={objects}
                  pageObjects={currentPageObjects}
                  currentPageId={currentPageMeta?.id || null}
                  layers={layers}
                  selectionIds={selectionIds}
                  onSelectionChange={onSetSelection}
                  interactionState={interactionState}
                  setInteractionState={setInteractionState}
                  onAddObject={onAddObject}
                  onDeleteObject={onDeleteObject}
                  onUpdateObject={onUpdateObject}
                  onBatchUpdateObjects={onBatchUpdateObjects}
                  signatureDataUrl={signatureDataUrl}
                  onRequestSignature={onRequestSignature}
                  onCropApply={onCropApply}
                  onCropCancel={onCropCancel}
                  onDropFile={onDropFile}
                  watermarkText={watermarkText}
                  imagePlacement={imagePlacement}
                  onImagePlaced={onImagePlaced}
                  onImagePlacementCancel={onImagePlacementCancel}
                  toolDefaults={toolDefaults}
                  pdfjsReady={pdfjsReady}
                  onOpen={onHandleOpen}
                  onCanvasContextMenu={handleCanvasContextMenu}
                />
              </div>
            </div>
            {renderDoc ? (
              <>
                <div className="canvas-zoom-pill">
                  <button onClick={onZoomOut} disabled={zoom <= 0.25} title="Zoom out" aria-label="Zoom out">
                    <ZoomOut size={14} strokeWidth={1.9} />
                  </button>
                  <button className="canvas-zoom-value" onClick={onZoomReset} title="Reset to 100%">
                    {Math.round(zoom * 100)}%
                  </button>
                  <button onClick={onZoomIn} disabled={zoom >= 3} title="Zoom in" aria-label="Zoom in">
                    <ZoomIn size={14} strokeWidth={1.9} />
                  </button>
                </div>
                <div className="canvas-page-pill">
                  <button onClick={() => onJumpToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>&lt;</button>
                  <span>{currentPage} / {numPages}</span>
                  <button onClick={() => onJumpToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages}>&gt;</button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {inspectorCollapsed ? (
          <button
            type="button"
            className="review-panel-reopen"
            onClick={onToggleInspector}
            title="Show review panel"
            aria-label="Show review panel"
          >
            <PanelRightOpen size={16} />
            <span>Panel</span>
          </button>
        ) : (
          <div className="review-panel-right">
            <ContextInspector
              tabs={reviewTabs}
              activeTab={reviewPanelTab}
              onTabChange={onReviewPanelTabChange}
              onCollapse={onToggleInspector}
            >
              {panelContent}
            </ContextInspector>
          </div>
        )}
      </div>
      {ctxMenu ? (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenuItems}
          onClose={closeCtxMenu}
        />
      ) : null}
    </section>
  );
}
