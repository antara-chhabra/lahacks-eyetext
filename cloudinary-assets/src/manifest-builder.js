'use strict';

require('dotenv').config();
const fs           = require('fs');
const path         = require('path');
const cloudinary   = require('cloudinary').v2;
const { buildUrl } = require('./theme-presets');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const THEMES   = ['standard', 'highContrast', 'largeText'];
const OUT_DIR  = path.join(__dirname, '..', 'output');
const OUT_FILE = path.join(OUT_DIR, 'tile-manifest.json');

// Fetch all Cloudinary resources tagged "catalyst-care", handling pagination.
async function fetchAllResources() {
  const resources = [];
  let nextCursor  = undefined;

  do {
    const opts = { resource_type: 'image', max_results: 500 };
    if (nextCursor) opts.next_cursor = nextCursor;

    const result = await cloudinary.api.resources_by_tag('catalyst-care', opts);
    resources.push(...result.resources);
    nextCursor = result.next_cursor;
  } while (nextCursor);

  return resources;
}

async function main() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    console.error('Error: CLOUDINARY_CLOUD_NAME is not set. Copy .env.example → .env and fill in credentials.');
    process.exit(1);
  }

  console.log('Fetching resources tagged "catalyst-care" from Cloudinary...');
  const resources = await fetchAllResources();
  console.log(`Found ${resources.length} resource(s).`);

  if (resources.length === 0) {
    console.warn('Warning: no resources found. Run `npm run upload` first.');
  }

  const manifest = {};

  for (const resource of resources) {
    // Public ID format: catalyst-care/{category}/{tile_id_lowercase}
    // Derive the canonical tile ID by uppercasing the last path segment.
    const parts   = resource.public_id.split('/');
    const tileKey = parts[parts.length - 1].toUpperCase(); // "water" → "WATER"

    manifest[tileKey] = {
      standard:     buildUrl(cloudName, resource.public_id, 'standard'),
      highContrast: buildUrl(cloudName, resource.public_id, 'highContrast'),
      largeText:    buildUrl(cloudName, resource.public_id, 'largeText'),
    };
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Manifest written → ${OUT_FILE}  (${Object.keys(manifest).length} tile(s))`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
