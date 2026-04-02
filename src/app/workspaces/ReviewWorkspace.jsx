import {
  MousePointer2, Highlighter, Pencil, Type, PenTool, Eraser,
} from 'lucide-react';
import LayersPanel from '../../components/LayersPanel';
import InspectorPanel from '../../components/InspectorPanel';
import PageThumbnails from '../../components/PageThumbnails';
import PDFViewer from '../../components/PDFViewer';
import EvidencePanel from '../../components/EvidencePanel';
import ContextInspector from '../panels/ContextInspector';
import AssistantDock from '../panels/AssistantDock';

const REVIEW_TABS = [
  { id: 'selection', label: 'Current Tool' },
  { id: 'findings', label: 'Page Issues' },
  { id: 'pages', label: 'Page List' },
  { id: 'assistant', label: 'AI Review' },
];

export default function ReviewWorkspace({
  renderDoc,
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
  fileName,
  watermarkText,
  imagePlacement,
  signatureDataUrl,
  evidenceIndex,
  pageAnnotations,
  reviewFindings = [],
  reviewPanelTab,
  onReviewPanelTabChange,
  onViewerWheel,
  onHandleOpen,
  onHandleInsertPdfPages,
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
}) {
  let panelContent = null;

  if (reviewPanelTab === 'selection') {
    panelContent = (
      <>
        <div className="context-card">
          <div className="context-card-title">Active Tool</div>
          <div className="context-tool-name">{activeToolConfig.title}</div>
          {activeToolConfig.fields.length === 0 ? (
            <div className="context-muted">No adjustable options for this tool.</div>
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
      <div className="review-action-bar">
        <button type="button" className="btn-secondary" onClick={onHandleOpen} disabled={!pdfjsReady}>
          Open PDF
        </button>
        <button
          type="button"
          className={`btn-secondary ${activeTool === 'highlight' ? 'active' : ''}`}
          onClick={() => onHandleToolChange('highlight')}
          disabled={!renderDoc}
        >
          Highlight
        </button>
        <button
          type="button"
          className={`btn-secondary ${activeTool === 'draw' ? 'active' : ''}`}
          onClick={() => onHandleToolChange('draw')}
          disabled={!renderDoc}
        >
          Draw
        </button>
        <button
          type="button"
          className={`btn-secondary ${activeTool === 'text' ? 'active' : ''}`}
          onClick={() => onHandleToolChange('text')}
          disabled={!renderDoc}
        >
          Text
        </button>
        <button
          type="button"
          className={`btn-secondary ${activeTool === 'signature' ? 'active' : ''}`}
          onClick={() => onHandleToolChange('signature')}
          disabled={!renderDoc}
        >
          Signature
        </button>
        <button type="button" className="btn-secondary" onClick={onHandleInsertPdfPages} disabled={!renderDoc}>
          Insert PDF Pages
        </button>
        <button type="button" className="btn-secondary" onClick={() => onRunSuggestedAction('Summarize current page')} disabled={!renderDoc}>
          Summarize Page
        </button>
        <button type="button" className="btn-secondary" onClick={onHandleOpen} disabled={!pdfjsReady}>
          Open Different PDF
        </button>
      </div>

      <div className="review-layout">
        <div className="review-panel-left">
          <div className="tool-rail">
            {[
              { id: 'select', icon: MousePointer2, label: 'Select' },
              { id: 'highlight', icon: Highlighter, label: 'Highlight' },
              { id: 'draw', icon: Pencil, label: 'Draw' },
              { id: 'text', icon: Type, label: 'Text' },
              { id: 'note', icon: PenTool, label: 'Signature' },
              { id: 'eraser', icon: Eraser, label: 'Whiteout' },
            ].map((item) => {
              const mappedTool = item.id === 'note' ? 'signature' : item.id === 'eraser' ? 'edit' : item.id;
              const isActive = activeTool === mappedTool;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`tool-rail-button ${isActive ? 'active' : ''}`}
                  onClick={() => onHandleToolChange(mappedTool)}
                  title={item.label}
                  aria-label={item.label}
                  disabled={!renderDoc || !pdfjsReady}
                >
                  <Icon size={16} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>

          <div className="review-document-summary">
            <div className="context-card">
              <div className="context-card-title">Document</div>
              <div className="workspace-list">
                <div className="workspace-list-row">
                  <span>File</span>
                  <strong>{fileName}</strong>
                </div>
                <div className="workspace-list-row">
                  <span>Page</span>
                  <strong>{currentPage} / {numPages || 0}</strong>
                </div>
                <div className="workspace-list-row">
                  <span>Zoom</span>
                  <strong>{Math.round(zoom * 100)}%</strong>
                </div>
                <div className="workspace-list-row">
                  <span>Watermark</span>
                  <strong>{watermarkText ? 'Enabled' : 'None'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="review-canvas">
          <div className="canvas-stage">
            <div className="canvas-scroll-container" onWheel={onViewerWheel}>
              <div className="canvas-stage-inner">
                <PDFViewer
                  renderDoc={renderDoc}
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
                />
              </div>
            </div>
            {renderDoc ? (
              <div className="canvas-page-pill">
                <button onClick={() => onJumpToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>&lt;</button>
                <span>{currentPage} / {numPages}</span>
                <button onClick={() => onJumpToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages}>&gt;</button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="review-panel-right">
          <ContextInspector
            tabs={REVIEW_TABS}
            activeTab={reviewPanelTab}
            onTabChange={onReviewPanelTabChange}
          >
            {panelContent}
          </ContextInspector>
        </div>
      </div>
    </section>
  );
}
