import { useEffect, useState } from 'react';
import type { HistoryEntry } from '../types';
import { TILE_BY_ID } from '../tileData';

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';
const USER_ID  = import.meta.env.VITE_DEMO_USER_ID ?? 'demo-1';

const URGENCY_COLORS: Record<number, string> = {
  5: 'var(--color-danger)',
  4: '#ff6b35',
  3: '#ffd700',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)  return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function CaregiverDashboard() {
  const [history, setHistory]   = useState<HistoryEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND}/history/${USER_ID}?limit=30`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data: HistoryEntry[]) => setHistory(data))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="dashboard__header">
        <h1 className="dashboard__title">Caregiver Dashboard</h1>
        {loading && <span className="spinner" />}
      </div>

      {error && (
        <p className="empty-state">
          Backend not running — start it with <code>cd backend &amp;&amp; npm run dev</code>
        </p>
      )}

      {!loading && !error && history.length === 0 && (
        <p className="empty-state">No messages yet. Select a tile on the AAC board to generate one.</p>
      )}

      <div className="history-list">
        {history.map(entry => {
          const tile    = TILE_BY_ID[entry.tile_id];
          const isUrgent = entry.urgency >= 4;
          return (
            <div key={entry.id} className={`history-item${isUrgent ? ' history-item--emergency' : ''}`}>
              <span style={{ fontSize: '1.5rem' }} aria-hidden="true">
                {tile?.emoji ?? '💬'}
              </span>
              <div style={{ flex: 1 }}>
                <p className="history-item__text">{entry.text}</p>
                <div className="history-item__badges">
                  {entry.destinations.map(d => (
                    <span key={d} className={`badge badge--${d}`}>{d}</span>
                  ))}
                  {entry.urgency >= 4 && (
                    <span
                      className="badge"
                      style={{ background: 'rgba(255,71,87,0.2)', color: URGENCY_COLORS[entry.urgency] ?? 'var(--color-danger)' }}
                    >
                      urgency {entry.urgency}
                    </span>
                  )}
                </div>
              </div>
              <span className="history-item__time">{timeAgo(entry.created_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
