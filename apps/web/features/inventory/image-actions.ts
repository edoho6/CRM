'use server';

import { randomUUID } from 'node:crypto';
import { getScopeWithAbility } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Herb photographs.
 *
 * Stored in the public `herb-images` bucket under `<clinic_id>/<herb_id>/…`, and
 * the herb row keeps the public URL so a plain <img> can show it. Public on
 * purpose: a picture of a plant is not patient data, and a signed-URL dance for
 * every catalogue thumbnail would cost more than it protects.
 */

const BUCKET = 'herb-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extensionFor(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

/** Object key inside the bucket, recovered from a public URL we issued. */
function objectPathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export async function uploadHerbImage(
  herbId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) return actionError(new Error('file_required'));
  if (file.size > MAX_IMAGE_BYTES) return actionError(new Error('file_too_large'));
  if (!ALLOWED_TYPES.has(file.type)) return actionError(new Error('unsupported_type'));

  const attribution = String(formData.get('attribution') ?? '').trim() || null;

  const { data: herb } = await scope.supabase
    .from('herbs')
    .select('id, image_url')
    .eq('id', herbId)
    .maybeSingle<{ id: string; image_url: string | null }>();
  if (!herb) return actionError(new Error('herb_not_found'));

  const path = `${scope.context.clinic.id}/${herbId}/${randomUUID()}.${extensionFor(file.type)}`;

  const { error: uploadError } = await scope.supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return actionError(new Error(uploadError.message));

  const { data: publicUrl } = scope.supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error } = await scope.supabase
    .from('herbs')
    .update({ image_url: publicUrl.publicUrl, image_attribution: attribution })
    .eq('id', herbId);
  if (error) {
    await scope.supabase.storage.from(BUCKET).remove([path]);
    return actionError(error);
  }

  // The previous picture is now unreferenced; clear it rather than let the
  // bucket accumulate every replaced photo.
  const previous = herb.image_url ? objectPathFromUrl(herb.image_url) : null;
  if (previous) await scope.supabase.storage.from(BUCKET).remove([previous]);

  return actionOk({ url: publicUrl.publicUrl });
}

export async function removeHerbImage(herbId: string): Promise<ActionResult> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const { data: herb } = await scope.supabase
    .from('herbs')
    .select('image_url')
    .eq('id', herbId)
    .maybeSingle<{ image_url: string | null }>();

  const path = herb?.image_url ? objectPathFromUrl(herb.image_url) : null;
  if (path) await scope.supabase.storage.from(BUCKET).remove([path]);

  const { error } = await scope.supabase
    .from('herbs')
    .update({ image_url: null, image_attribution: null })
    .eq('id', herbId);
  if (error) return actionError(error);
  return actionOk();
}
