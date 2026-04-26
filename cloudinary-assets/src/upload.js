'use strict';

require('dotenv').config();
const path       = require('path');
const fs         = require('fs');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// Single source of truth for all 29 tile IDs grouped by category.
// Matches the canonical list in shared/api-contract.md.
const CATEGORY_MAP = {
  needs:     ['WATER', 'FOOD', 'BATHROOM', 'PAIN', 'MEDICATION', 'HOT', 'COLD', 'SLEEP'],
  people:    ['FAMILY', 'CAREGIVER', 'DOCTOR', 'NURSE', 'DAUGHTER', 'SON'],
  feelings:  ['HAPPY', 'SAD', 'TIRED', 'SCARED', 'FRUSTRATED'],
  responses: ['YES', 'NO', 'MAYBE', 'THANK_YOU', 'PLEASE'],
  actions:   ['HELLO', 'GOODBYE', 'HELP', 'CALL', 'STOP'],
};

const IMAGE_EXTS  = /\.(png|svg|jpg|jpeg|webp)$/i;
const SOURCE_ROOT = path.join(__dirname, '..', 'source-icons');

async function uploadCategory(category) {
  const dir = path.join(SOURCE_ROOT, category);

  if (!fs.existsSync(dir)) {
    console.log(`[skip] source-icons/${category}/ does not exist`);
    return;
  }

  const files = fs.readdirSync(dir).filter(f => IMAGE_EXTS.test(f));

  if (files.length === 0) {
    console.log(`[skip] source-icons/${category}/ is empty`);
    return;
  }

  for (const file of files) {
    const baseName = path.basename(file, path.extname(file)).toLowerCase();
    const publicId = `catalyst-care/${category}/${baseName}`;
    const filePath = path.join(dir, file);

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        public_id:       publicId,
        overwrite:       false,   // idempotent: skip if public ID already exists
        unique_filename: false,
        resource_type:   'image',
        tags:            ['catalyst-care', category],
      });
      console.log(`[ok]   uploaded  ${publicId}  (version ${result.version})`);
    } catch (err) {
      // Cloudinary v1 SDK throws an error object with http_code when overwrite:false
      // and the asset already exists. Treat that as a benign skip, not a failure.
      if (err.http_code === 400 && err.message && err.message.includes('already exists')) {
        console.log(`[skip] exists    ${publicId}`);
      } else {
        console.error(`[fail] ${publicId}: ${err.message || err}`);
        process.exitCode = 1;
      }
    }
  }
}

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.error('Error: CLOUDINARY_CLOUD_NAME is not set. Copy .env.example → .env and fill in credentials.');
    process.exit(1);
  }

  console.log('Starting idempotent upload to Cloudinary...\n');
  for (const category of Object.keys(CATEGORY_MAP)) {
    await uploadCategory(category);
  }
  console.log('\nUpload complete.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
