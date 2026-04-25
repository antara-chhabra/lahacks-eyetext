import { useEffect, useRef, useState } from 'react';

const CLOUD_NAME     = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET  = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

interface UploadResult {
  public_id: string;
  secure_url: string;
  original_filename: string;
}

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (error: unknown, result: { event: string; info: UploadResult }) => void
      ) => { open: () => void };
    };
  }
}

/**
 * Cloudinary Upload Widget integration.
 * Allows admins to upload new tile icons directly to the catalyst-care/ folder
 * in Cloudinary — no server required.
 *
 * After uploading, run `npm run manifest` in cloudinary-assets/ to regenerate
 * the tile manifest with the new URLs.
 */
export function UploadSection() {
  const widgetRef              = useRef<ReturnType<NonNullable<Window['cloudinary']>['createUploadWidget']> | null>(null);
  const [uploads, setUploads]  = useState<UploadResult[]>([]);
  const [ready, setReady]      = useState(false);
  const [scriptError, setScriptError] = useState(false);

  // Inject Cloudinary Upload Widget script once
  useEffect(() => {
    if (document.getElementById('cld-upload-widget')) { setReady(true); return; }
    const script   = document.createElement('script');
    script.id      = 'cld-upload-widget';
    script.src     = 'https://upload-widget.cloudinary.com/global/all.js';
    script.async   = true;
    script.onload  = () => setReady(true);
    script.onerror = () => setScriptError(true);
    document.body.appendChild(script);
  }, []);

  function openWidget() {
    if (!window.cloudinary) return;

    if (!widgetRef.current) {
      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName:    CLOUD_NAME,
          uploadPreset: UPLOAD_PRESET,
          folder:       'catalyst-care',
          tags:         ['catalyst-care'],
          sources:      ['local', 'url', 'camera'],
          multiple:     true,
          clientAllowedFormats: ['png', 'svg', 'jpg', 'jpeg', 'webp'],
          maxFileSize:  2_000_000,
          cropping:     false,
          styles: {
            palette: {
              window:      '#1a1d2e',
              windowBorder:'#2a2d3e',
              tabIcon:     '#6c63ff',
              menuIcons:   '#8b8fa8',
              textDark:    '#e8eaf6',
              textLight:   '#8b8fa8',
              link:        '#6c63ff',
              action:      '#00d4aa',
              inactiveTabIcon: '#8b8fa8',
              error:       '#ff4757',
              inProgress:  '#6c63ff',
              complete:    '#00d4aa',
              sourceBg:    '#0f1117',
            },
          },
        },
        (_error, result) => {
          if (result.event === 'success') {
            setUploads(prev => [...prev, result.info]);
          }
        }
      );
    }

    widgetRef.current.open();
  }

  const unconfigured = !CLOUD_NAME || !UPLOAD_PRESET;

  return (
    <div className="upload-section">
      <h1 className="upload-section__title">Upload Tile Icons</h1>
      <p className="upload-section__subtitle">
        Add new icons to your Cloudinary library. Icons are automatically available
        in all three accessibility themes (standard, high-contrast, large) — no extra
        uploads needed. After uploading, run{' '}
        <code style={{ color: 'var(--color-accent)', fontSize: '0.8rem' }}>npm run manifest</code>
        {' '}in <code style={{ color: 'var(--color-accent)', fontSize: '0.8rem' }}>cloudinary-assets/</code>
        {' '}to regenerate the tile manifest.
      </p>

      <div className="upload-widget-wrap" onClick={!unconfigured ? openWidget : undefined}>
        {unconfigured ? (
          <>
            <p style={{ color: 'var(--color-muted)', marginBottom: 12 }}>
              Set <code>VITE_CLOUDINARY_CLOUD_NAME</code> and{' '}
              <code>VITE_CLOUDINARY_UPLOAD_PRESET</code> in <code>.env</code> to enable uploads.
            </p>
            <a
              href="https://console.cloudinary.com/"
              target="_blank"
              rel="noreferrer"
              className="upload-btn"
              onClick={e => e.stopPropagation()}
            >
              Open Cloudinary Console
            </a>
          </>
        ) : scriptError ? (
          <p style={{ color: 'var(--color-danger)' }}>Failed to load Cloudinary Upload Widget.</p>
        ) : !ready ? (
          <span className="spinner" />
        ) : (
          <>
            <p style={{ color: 'var(--color-muted)', marginBottom: 12 }}>
              Drop icon files here or click to browse
            </p>
            <button className="upload-btn" type="button">Upload Icons</button>
          </>
        )}
      </div>

      {uploads.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: 8 }}>
            Uploaded this session ({uploads.length}):
          </p>
          {uploads.map(u => (
            <div
              key={u.public_id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--color-border)',
                fontSize: '0.82rem',
              }}
            >
              <img
                src={u.secure_url}
                alt={u.original_filename}
                style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }}
              />
              <code style={{ color: 'var(--color-accent)', flex: 1 }}>{u.public_id}</code>
            </div>
          ))}
          <p className="upload-section__note">
            Run <code>npm run manifest</code> in <code>cloudinary-assets/</code> to publish these to the tile board.
          </p>
        </div>
      )}
    </div>
  );
}
