'use strict';

// Face-crop transformation: auto-detects the face, crops to 200×200, applies circle mask.
// Used for caregiver and patient profile images — NOT for tile icons.
const AVATAR_TRANSFORM = 'g_face,c_thumb,w_200,h_200,r_max';

/**
 * Build a circular face-cropped avatar URL from a Cloudinary public ID.
 *
 * @param {string} cloudName - Cloudinary cloud name
 * @param {string} publicId  - Public ID of the uploaded photo
 * @returns {string} Full HTTPS Cloudinary URL
 */
function buildAvatarUrl(cloudName, publicId) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${AVATAR_TRANSFORM}/${publicId}`;
}

module.exports = { buildAvatarUrl, AVATAR_TRANSFORM };
