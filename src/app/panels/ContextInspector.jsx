export default function ContextInspector({
  tabs = [],
  activeTab,
  onTabChange,
  children,
}) {
  const activePanel = tabs.find((tab) => tab.id === activeTab) || tabs[0] || null;

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-header">
        {activePanel ? (
          <div className="workspace-panel-summary">
            <div className="workspace-panel-summary-copy">
              <span className="workspace-panel-summary-eyebrow">Review Panel</span>
              <strong>{activePanel.label}</strong>
              {activePanel.description ? <span>{activePanel.description}</span> : null}
            </div>
            {activePanel.meta ? <span className="workspace-panel-summary-meta">{activePanel.meta}</span> : null}
          </div>
        ) : null}
        <div className="workspace-panel-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`workspace-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="workspace-panel-body">{children}</div>
    </section>
  );
}
