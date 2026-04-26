'use strict';

const fetch = require('node-fetch');
const fs    = require('fs');
const path  = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'output', 'tile-manifest.json');
const THEMES        = ['standard', 'highContrast', 'largeText'];

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const ct  = (res.headers.get('content-type') || '').toLowerCase();
    if (res.status !== 200) {
      return `HTTP ${res.status}`;
    }
    if (!ct.startsWith('image/')) {
      return `non-image content-type "${ct}"`;
    }
    return null; // ok
  } catch (err) {
    return `network error: ${err.message}`;
  }
}

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found: ${MANIFEST_PATH}`);
    console.error('Run `npm run manifest` first (or `npm run upload && npm run manifest` for a fresh build).');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  // Strip internal metadata keys (e.g. "_stub")
  const tileIds = Object.keys(manifest).filter(k => !k.startsWith('_'));
  const total   = tileIds.length * THEMES.length;

  console.log(`Verifying ${tileIds.length} tiles × ${THEMES.length} themes = ${total} URLs...\n`);

  const errors  = [];
  const checks  = [];

  for (const tileId of tileIds) {
    for (const theme of THEMES) {
      const url = manifest[tileId]?.[theme];
      if (!url) {
        errors.push(`[${tileId}/${theme}] missing URL in manifest`);
        continue;
      }
      checks.push(
        checkUrl(url).then(err => {
          if (err) errors.push(`[${tileId}/${theme}] ${err}  →  ${url}`);
        })
      );
    }
  }

  await Promise.all(checks);

  if (errors.length > 0) {
    console.error(`${errors.length} failure(s):\n`);
    errors.forEach(e => console.error('  ' + e));
    process.exit(1);
  }

  console.log(`All ${total} URLs OK.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
