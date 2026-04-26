'use strict';

// Cloudinary transformation strings for each accessibility theme.
// standard:     no transformation — raw delivery
// highContrast: increases contrast + brightness for low-vision users
// largeText:    pads to 400×400 for larger touch/gaze targets (c_pad preserves aspect ratio)
const TRANSFORMS = {
  standard:     '',
  highContrast: 'e_contrast:50,e_brightness:20',
  largeText:    'c_pad,w_400,h_400',
};

/**
 * Build a Cloudinary delivery URL for a tile asset at a given theme.
 *
 * @param {string} cloudName  - Cloudinary cloud name (from CLOUDINARY_CLOUD_NAME)
 * @param {string} publicId   - e.g. "catalyst-care/needs/water"
 * @param {'standard'|'highContrast'|'largeText'} theme
 * @returns {string} Full HTTPS Cloudinary URL
 */
function buildUrl(cloudName, publicId, theme) {
  if (!Object.prototype.hasOwnProperty.call(TRANSFORMS, theme)) {
    throw new Error(`Unknown theme: "${theme}". Must be one of: ${Object.keys(TRANSFORMS).join(', ')}`);
  }
  const transform = TRANSFORMS[theme];
  const segment = transform ? `${transform}/` : '';
  return `https://res.cloudinary.com/${cloudName}/image/upload/${segment}${publicId}`;
}

module.exports = { TRANSFORMS, buildUrl };
