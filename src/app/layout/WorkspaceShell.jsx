export default function WorkspaceShell({
  nav,
  topbar,
  main,
  rightPanel,
  statusBar,
}) {
  return (
    <div className="workspace-shell">
      <div className="workspace-shell-nav">{nav}</div>
      <div className="workspace-shell-main">
        <div className="workspace-shell-topbar">{topbar}</div>
        <div className="workspace-shell-content">
          <div className="workspace-shell-stage">{main}</div>
          {rightPanel ? (
            <aside className="workspace-shell-aside">{rightPanel}</aside>
          ) : null}
        </div>
        <div className="workspace-shell-status">{statusBar}</div>
      </div>
    </div>
  );
}
