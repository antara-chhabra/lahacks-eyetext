import { useState, useEffect } from 'react';
import { AdvancedImage, lazyload, placeholder } from '@cloudinary/react';
import { buildTileImage } from '../cloudinary';
import type { Theme, TileMeta } from '../types';

const DWELL_MS = 1200;
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

interface Props {
  tile: TileMeta;
  theme: Theme;
  onSelect: (id: string) => void;
}

/**
 * Single AAC tile.
 * - Uses AdvancedImage from @cloudinary/react with lazyload + blur placeholder.
 * - Falls back to emoji when VITE_CLOUDINARY_CLOUD_NAME is not configured.
 * - Simulates gaze-dwell selection: hold mouse/touch for DWELL_MS to fire.
 */
export function TileCard({ tile, theme, onSelect }: Props) {
  const [dwelling, setDwelling]   = useState(false);
  const [selected, setSelected]   = useState(false);
  const [imgError, setImgError]   = useState(false);

  // Reset selected highlight after 800ms
  useEffect(() => {
    if (!selected) return;
    const t = setTimeout(() => setSelected(false), 800);
    return () => clearTimeout(t);
  }, [selected]);

  function startDwell() { setDwelling(true); }

  function endDwell() {
    if (!dwelling) return;
    setDwelling(false);
  }

  // Dwell timer — fires after DWELL_MS if still held
  useEffect(() => {
    if (!dwelling) return;
    const t = setTimeout(() => {
      setDwelling(false);
      setSelected(true);
      onSelect(tile.id);
    }, DWELL_MS);
    return () => clearTimeout(t);
  }, [dwelling, tile.id, onSelect]);

  const cldImg = !imgError && CLOUD_NAME
    ? buildTileImage(tile.publicId, theme)
    : null;

  return (
    <div
      className={`tile${dwelling ? ' tile--dwelling' : ''}${selected ? ' tile--selected' : ''}`}
      onMouseDown={startDwell}
      onMouseUp={endDwell}
      onMouseLeave={endDwell}
      onTouchStart={startDwell}
      onTouchEnd={endDwell}
      role="button"
      aria-label={tile.label}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(tile.id)}
    >
      {cldImg ? (
        <AdvancedImage
          cldImg={cldImg}
          className="tile__img"
          alt={tile.label}
          plugins={[lazyload(), placeholder({ mode: 'blur' })]}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="tile__emoji" aria-hidden="true">{tile.emoji}</span>
      )}
      <span className="tile__label">{tile.label}</span>
      <div className="tile__dwell" aria-hidden="true" />
    </div>
  );
}
