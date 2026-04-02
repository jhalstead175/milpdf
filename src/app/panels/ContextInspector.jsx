export default function ContextInspector({
  tabs = [],
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <section className="workspace-panel">
      <div className="workspace-panel-header">
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
