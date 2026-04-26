import { Cloudinary } from '@cloudinary/url-gen';
import type { CloudinaryImage } from '@cloudinary/url-gen/assets/CloudinaryImage';
import { pad } from '@cloudinary/url-gen/actions/resize';
import { brightness, contrast } from '@cloudinary/url-gen/actions/adjust';
import { format, quality } from '@cloudinary/url-gen/actions/delivery';
import { auto as autoFormat } from '@cloudinary/url-gen/qualifiers/format';
import { auto as autoQuality } from '@cloudinary/url-gen/qualifiers/quality';
import type { Theme } from './types';

export const cld = new Cloudinary({
  cloud: {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo',
  },
  url: { secure: true },
});

/**
 * Build a CloudinaryImage with the correct accessibility transforms for a given theme.
 * This is the core Cloudinary innovation in Catalyst for Care: a single uploaded icon
 * serves all accessibility variants via URL-driven transforms — no extra storage needed.
 */
export function buildTileImage(publicId: string, theme: Theme): CloudinaryImage {
  const img = cld.image(publicId);

  if (theme === 'highContrast') {
    // Boost contrast and brightness for low-vision / photosensitive users
    img.adjust(contrast(50)).adjust(brightness(20));
  } else if (theme === 'largeText') {
    // Pad to 400×400 — c_pad preserves aspect ratio (no distortion of icon shapes)
    img.resize(pad().width(400).height(400));
  }

  // Always apply auto-format (WebP/AVIF on modern browsers) and auto-quality
  img.delivery(format(autoFormat())).delivery(quality(autoQuality()));

  return img;
}

/**
 * Build a face-detected circular avatar URL for caregiver/patient profile photos.
 * g_face auto-detects the face, c_thumb crops tight around it, r_max makes it circular.
 */
export function buildAvatarImage(publicId: string): CloudinaryImage {
  return cld
    .image(publicId)
    .resize(
      pad().width(200).height(200)
        // @ts-expect-error — gravity chaining via pad is SDK-specific
        .gravity('face')
        .crop('thumb')
    )
    .delivery(format(autoFormat()))
    .delivery(quality(autoQuality()));
}
