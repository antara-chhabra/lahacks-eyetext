import type { Theme } from '../types';

const THEMES: { value: Theme; label: string; desc: string }[] = [
  { value: 'standard',     label: 'Standard',      desc: 'Default colors' },
  { value: 'highContrast', label: 'High Contrast',  desc: '+50 contrast, +20 brightness' },
  { value: 'largeText',    label: 'Large',          desc: '400×400 padded icons' },
];

interface Props {
  theme: Theme;
  onChange: (t: Theme) => void;
}

/**
 * Theme switcher — the core Cloudinary demo moment.
 * Switching theme changes all 29 tile images simultaneously via Cloudinary URL transforms.
 * Zero extra storage: one uploaded icon, infinite accessibility variants on-the-fly.
 */
export function ThemeSelector({ theme, onChange }: Props) {
  return (
    <div className="theme-bar">
      <span className="theme-bar__label">Accessibility</span>
      {THEMES.map(t => (
        <button
          key={t.value}
          className={`theme-btn${theme === t.value ? ' theme-btn--active' : ''}`}
          onClick={() => onChange(t.value)}
          title={t.desc}
        >
          {t.label}
        </button>
      ))}
      <span className="theme-bar__powered">
        Transforms by{' '}
        <a href="https://cloudinary.com" target="_blank" rel="noreferrer">Cloudinary</a>
        {' '}— one image, every variant
      </span>
    </div>
  );
}
