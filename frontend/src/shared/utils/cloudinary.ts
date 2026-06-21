/**
 * Cloudinary unsigned upload utility.
 *
 * Uploads a base64 data URL or a File object to Cloudinary and returns the
 * secure HTTPS URL of the uploaded asset.
 *
 * Config is read from Vite env vars — add to your .env:
 *   VITE_CLOUDINARY_CLOUD_NAME=djz41kqkv
 *   VITE_CLOUDINARY_UPLOAD_PRESET=sahayog_unsigned
 */

const CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;
const UPLOAD_URL   = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/** Returns true if the string is already a remote URL (not a base64 data URL). */
export function isRemoteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Upload a single image (base64 data URL or File) to Cloudinary.
 * Returns the secure Cloudinary URL, or throws on failure.
 */
export async function uploadImageToCloudinary(
  image: string | File,
  folder = 'sahayog_reports',
): Promise<string> {
  const formData = new FormData();
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  if (typeof image === 'string') {
    // base64 data URL — send as-is, Cloudinary accepts it
    formData.append('file', image);
  } else {
    formData.append('file', image);
  }

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = (err as { error?: { message?: string } }).error?.message ?? response.statusText;
    console.error('[Cloudinary] Upload failed:', { status: response.status, message, cloud: CLOUD_NAME, preset: UPLOAD_PRESET });
    throw new Error(`Cloudinary upload failed (${response.status}): ${message}`);
  }

  const data = await response.json() as { secure_url: string };
  return data.secure_url;
}

/**
 * Upload an array of images to Cloudinary in parallel.
 * Images that are already remote URLs are passed through unchanged.
 * Returns an array of Cloudinary URLs in the same order.
 */
export async function uploadImagesToCloudinary(
  images: string[],
  folder = 'sahayog_reports',
): Promise<string[]> {
  return Promise.all(
    images.map((img) =>
      isRemoteUrl(img) ? Promise.resolve(img) : uploadImageToCloudinary(img, folder),
    ),
  );
}
