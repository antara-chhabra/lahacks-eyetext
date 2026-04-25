import { TileCard } from './TileCard';
import { TILE_CATEGORIES, CATEGORY_LABELS } from '../tileData';
import type { Theme } from '../types';

interface Props {
  theme: Theme;
  loading: boolean;
  onSelect: (tileId: string) => void;
}

export function TileBoard({ theme, loading, onSelect }: Props) {
  return (
    <div className="tile-board">
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          <span className="spinner" />
          Processing with AI agents…
        </div>
      )}
      {Object.entries(TILE_CATEGORIES).map(([category, tiles]) => (
        <section key={category} className="category">
          <h2 className="category__title">{CATEGORY_LABELS[category]}</h2>
          <div className="tile-row">
            {tiles.map(tile => (
              <TileCard
                key={tile.id}
                tile={tile}
                theme={theme}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
