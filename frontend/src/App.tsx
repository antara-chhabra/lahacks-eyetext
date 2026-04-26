import { useState } from 'react';
import type { Theme, RouteDecision } from './types';
import { ThemeSelector } from './components/ThemeSelector';
import { TileBoard } from './components/TileBoard';
import { MessageBanner } from './components/MessageBanner';
import { CaregiverDashboard } from './components/CaregiverDashboard';
import { UploadSection } from './components/UploadSection';

type Tab = 'board' | 'caregiver' | 'upload';

export default function App() {
  const [theme, setTheme]               = useState<Theme>('standard');
  const [tab, setTab]                   = useState<Tab>('board');
  const [lastDecision, setLastDecision] = useState<RouteDecision | null>(null);
  const [loading, setLoading]           = useState(false);

  async function handleTileSelect(tileId: string) {
    setLoading(true);
    setLastDecision(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_AGENT_URL ?? 'http://localhost:8000'}/intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: [],
            dwell_target_id: tileId,
            dwell_duration_ms: 1300,
            session_id: `sess-${Date.now()}`,
            user_id: import.meta.env.VITE_DEMO_USER_ID ?? 'demo-1',
          }),
        }
      );
      if (res.ok) {
        const data: RouteDecision = await res.json();
        setLastDecision(data);
        // Auto-play TTS if audio URL present
        if (data.message.audio_url) {
          new Audio(data.message.audio_url).play().catch(() => null);
        }
      }
    } catch {
      // Agents not running — show a demo message so the UI still works
      setLastDecision({
        message: { text: `[Demo] Selected: ${tileId}` },
        destinations: ['dashboard'],
        sms_sent: false,
        routed_at: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <span className="header__logo">Catalyst for Care</span>
        <span className="header__badge">Powered by Cloudinary</span>
        <nav className="nav">
          <button className={`nav__btn${tab === 'board'     ? ' nav__btn--active' : ''}`} onClick={() => setTab('board')}>AAC Board</button>
          <button className={`nav__btn${tab === 'caregiver' ? ' nav__btn--active' : ''}`} onClick={() => setTab('caregiver')}>Caregiver</button>
          <button className={`nav__btn${tab === 'upload'    ? ' nav__btn--active' : ''}`} onClick={() => setTab('upload')}>Upload Icons</button>
        </nav>
      </header>

      <main className="main">
        {tab === 'board' && (
          <>
            <ThemeSelector theme={theme} onChange={setTheme} />
            <TileBoard theme={theme} loading={loading} onSelect={handleTileSelect} />
          </>
        )}
        {tab === 'caregiver' && <CaregiverDashboard />}
        {tab === 'upload'    && <UploadSection />}
      </main>

      {lastDecision && (
        <MessageBanner decision={lastDecision} onClose={() => setLastDecision(null)} />
      )}
    </div>
  );
}
