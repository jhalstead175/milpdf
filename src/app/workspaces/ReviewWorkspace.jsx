import {
  MousePointer2, Highlighter, Pencil, Type, PenTool, Eraser, ShieldOff,
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
  const pageIssueCount = pageAnnotations.length + reviewFindings.length;
  const evidenceCount = evidenceIndex.markers.length;
  const documentReady = renderDoc && pageIssueCount === 0;
  const reviewStatusLabel = !renderDoc
    ? 'No document loaded'
    : documentReady
      ? 'Ready for export review'
      : `${pageIssueCount} review item${pageIssueCount === 1 ? '' : 's'} need attention`;
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
      <div className="review-overview">
        <div className="review-overview-card review-overview-primary">
          <div className="review-overview-copy">
            <span className="review-overview-eyebrow">Document Review</span>
            <h2>{renderDoc ? fileName : 'Open a PDF to begin review'}</h2>
            <p>
              {renderDoc
                ? reviewStatusLabel
                : 'Load a document to start annotations, issue review, evidence prep, and export checks.'}
            </p>
          </div>
          <div className="review-overview-status">
            <span className={`review-status-pill ${documentReady ? 'ready' : 'attention'}`}>
              {reviewStatusLabel}
            </span>
            <span className="review-status-pill subtle">Current tool: {activeToolConfig.title}</span>
          </div>
        </div>
        <div className="review-overview-card review-overview-metrics">
          <div className="review-metric-chip">
            <strong>{numPages || 0}</strong>
            <span>Pages</span>
          </div>
          <div className="review-metric-chip">
            <strong>{objects.length}</strong>
            <span>Annotations</span>
          </div>
          <div className="review-metric-chip">
            <strong>{pageIssueCount}</strong>
            <span>Review items</span>
          </div>
          <div className="review-metric-chip">
            <strong>{evidenceCount}</strong>
            <span>Evidence refs</span>
          </div>
        </div>
        <div className="review-overview-card review-overview-actions">
          <button type="button" className="btn-primary" onClick={onHandleOpen} disabled={!pdfjsReady}>
            {renderDoc ? 'Open Different PDF' : 'Open PDF'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onRunSuggestedAction('Summarize current page')}
            disabled={!renderDoc}
          >
            Summarize Page
          </button>
          <button type="button" className="btn-secondary" onClick={onHandleInsertPdfPages} disabled={!renderDoc}>
            Insert PDF Pages
          </button>
        </div>
      </div>

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
              { id: 'redact', icon: ShieldOff, label: 'Redact' },
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
            <div className="context-card review-readiness-card">
              <div className="context-card-title">Review Readiness</div>
              <div className="workspace-list">
                <div className="workspace-list-row">
                  <span>Current tool</span>
                  <strong>{activeToolConfig.title}</strong>
                </div>
                <div className="workspace-list-row">
                  <span>Current page issues</span>
                  <strong>{pageIssueCount}</strong>
                </div>
                <div className="workspace-list-row">
                  <span>Evidence references</span>
                  <strong>{evidenceCount}</strong>
                </div>
              </div>
              <div className={`review-readiness-note ${documentReady ? 'ready' : 'attention'}`}>
                {reviewStatusLabel}
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
            tabs={reviewTabs}
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
