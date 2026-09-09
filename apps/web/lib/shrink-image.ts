/**
 * Makes a photograph small before it leaves the phone.
 *
 * A picture straight from a camera is 3–5 MB and four thousand pixels
 * across; a tongue on a treatment page is looked at in a frame a few hundred
 * pixels wide and zoomed at most a few times. Resizing to 1600 pixels on the
 * long side and re-encoding at 85% brings it to about 300 KB with no visible
 * difference in the coating — a tenth of the storage, for a hundred clinics
 * over years.
 *
 * Done in the browser, on the file, before the upload starts, so the network
 * carries the small version too. Orientation from the camera is honoured
 * (`imageOrientation: 'from-image'`), which is what keeps a portrait photo
 * from arriving on its side. Anything that is not an image, or that this
 * browser cannot decode, goes through untouched — a failure here must never
 * cost the photograph itself.
 */

export const DEFAULT_MAX_EDGE = 1600;
export const DEFAULT_QUALITY = 0.85;
/** Below this, the picture is left alone: re-encoding would gain nothing. */
const SMALL_ENOUGH_BYTES = 400 * 1024;

/** The size a picture ends up at, keeping its shape, no larger than `maxEdge` on its long side. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height, scaled: false };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}

/** A name for the re-encoded file: the original's, with a .jpg ending. */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

export async function shrinkImage(
  file: File,
  { maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_QUALITY } = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // GIFs animate and SVGs are not pixels; neither is a photograph.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    const { width, height, scaled } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    // Already small in both senses: nothing to gain, and a JPEG re-encode of
    // a small PNG would only add artefacts.
    if (!scaled && file.size <= SMALL_ENOUGH_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;
    // A re-encode that came out larger is not an improvement.
    if (!scaled && blob.size >= file.size) return file;

    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
