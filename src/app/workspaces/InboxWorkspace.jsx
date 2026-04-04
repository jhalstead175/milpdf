export default function InboxWorkspace({
  matterName,
  fileName,
  numPages,
  findings = [],
  evidenceItems = [],
  suggestedActions = [],
  toolGroups = [],
  quickStartSteps = [],
  starterWorkflows = [],
  onOpenDocument,
  onCreatePdfFromImages,
  onGoReview,
  onGoFindings,
  onRunSuggestedAction,
}) {
  const highPriorityFindings = findings.filter((finding) => finding.status === 'proposed').length;

  return (
    <section className="workspace-screen workspace-grid-two phase3-inbox">
      <div className="context-card context-card-span-2 quickstart-card">
        <div className="context-card-title">3-Minute First Success</div>
        <div className="quickstart-lead">
          Move from intake to a production-ready PDF with a guided path that surfaces the next useful step.
        </div>
        <div className="quickstart-grid">
          {quickStartSteps.map((step) => (
            <div key={step.id} className={`quickstart-step quickstart-step-${step.status}`}>
              <div className="quickstart-step-top">
                <span className="quickstart-step-index">{step.index}</span>
                <span className="quickstart-step-status">{step.statusLabel}</span>
              </div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
              <button
                type="button"
                className={step.primary ? 'btn-primary' : 'btn-secondary'}
                onClick={step.onAction}
                disabled={step.disabled}
              >
                {step.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="context-card context-card-span-2">
        <div className="context-card-title">Starter Workflows</div>
        <div className="starter-workflow-grid">
          {starterWorkflows.map((workflow) => (
            <section key={workflow.id} className="starter-workflow-card">
              <div className="starter-workflow-top">
                <div>
                  <h3>{workflow.title}</h3>
                  <p>{workflow.description}</p>
                </div>
                <span className="tool-group-pill">{workflow.duration}</span>
              </div>
              <div className="starter-workflow-meta">{workflow.outcome}</div>
              <button
                type="button"
                className={workflow.primary ? 'btn-primary' : 'btn-secondary'}
                onClick={workflow.onAction}
                disabled={workflow.disabled}
              >
                {workflow.actionLabel}
              </button>
            </section>
          ))}
        </div>
      </div>
      <div className="context-card">
        <div className="context-card-title">Matter Intake</div>
        <div className="workspace-metric-grid">
          <div className="workspace-metric">
            <span>Matter</span>
            <strong>{matterName}</strong>
          </div>
          <div className="workspace-metric">
            <span>Document</span>
            <strong>{fileName}</strong>
          </div>
          <div className="workspace-metric">
            <span>Pages loaded</span>
            <strong>{numPages || 0}</strong>
          </div>
          <div className="workspace-metric">
            <span>Pending findings</span>
            <strong>{highPriorityFindings}</strong>
          </div>
          <div className="workspace-metric">
            <span>Evidence items</span>
            <strong>{evidenceItems.length}</strong>
          </div>
        </div>
        <div className="context-actions">
          <button type="button" className="btn-primary" onClick={onOpenDocument}>
            Open document
          </button>
          <button type="button" className="btn-secondary" onClick={onCreatePdfFromImages}>
            Create PDF from images
          </button>
          <button type="button" className="btn-secondary" onClick={onGoReview}>
            Continue review
          </button>
          <button type="button" className="btn-secondary" onClick={onGoFindings}>
            Review findings
          </button>
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">Suggested Actions</div>
        <div className="assistant-action-list">
          {suggestedActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="assistant-action-card"
              onClick={() => onRunSuggestedAction(action.id)}
              disabled={action.disabled}
            >
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </button>
          ))}
          {suggestedActions.length === 0 ? (
            <div className="context-muted">Load a document to unlock suggested workflows.</div>
          ) : null}
        </div>
      </div>

      <div className="context-card context-card-span-2">
        <div className="context-card-title">PDF Tool Library</div>
        <div className="tool-groups-grid">
          {toolGroups.map((group) => (
            <section key={group.id} className="tool-group-card">
              <div className="tool-group-header">
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <span className="tool-group-pill">{group.items.length} tools</span>
              </div>
              <div className="tool-group-list">
                {group.items.map((item) => (
                  <div key={item.label} className="tool-list-item">
                    <div className="tool-list-copy">
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={item.onAction}
                      disabled={item.disabled}
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
