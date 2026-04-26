export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
}

export async function uploadToCloudinary(
  blob: Blob,
  cloudName: string,
  uploadPreset: string,
): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  form.append('file', blob, 'session.webm');
  form.append('upload_preset', uploadPreset);
  form.append('folder', 'catalyst-care/sessions');
  form.append('resource_type', 'video');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    { method: 'POST', body: form },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const data = await res.json();
  return { publicId: data.public_id, secureUrl: data.secure_url };
}
