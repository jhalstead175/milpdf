import TopBar from '../components/layout/TopBar';
import Sidebar from '../components/layout/Sidebar';
import AvaIntroCard from '../components/assistant/AvaIntroCard';
import AvaAssistantPanel from '../components/assistant/AvaAssistantPanel';

export default function AppShell() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-shell-body">
        <Sidebar />
        <main className="app-shell-main">
          <div className="v3-preview-note">
            V3 Shell Preview — experimental layout only.
          </div>
          <AvaIntroCard />
        </main>
        <aside className="app-shell-aside">
          <AvaAssistantPanel />
        </aside>
      </div>
    </div>
  );
}
