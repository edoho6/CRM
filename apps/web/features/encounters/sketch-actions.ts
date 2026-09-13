'use server';

import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import { logRecordAccess } from '@/lib/access-log';

/**
 * A saved page, fetched to be drawn over.
 *
 * The documents route serves a file by redirecting to a short-lived storage
 * address on another origin. An `<img>` does not mind, but a canvas does: a
 * picture from another origin taints it, and a tainted canvas refuses to
 * export — so editing a page would end in "could not save". The bytes come
 * through here instead, as a data address the canvas treats as its own.
 *
 * Only a page of the handwriting category is served this way: the route
 * remains the one door for every other document, with its export logging.
 * Opening a page to edit it is a view, and is logged as one.
 */
export async function loadSketchImage(documentId: string): Promise<ActionResult<{ dataUrl: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data: document, error } = await scope.supabase
    .from('patient_documents')
    .select('file_path, category')
    .eq('id', documentId)
    .maybeSingle<{ file_path: string; category: string }>();
  if (error || !document || document.category !== 'sketch') return actionError(error ?? new Error('not_found'));

  const { data: file, error: downloadError } = await scope.supabase.storage
    .from('patient-documents')
    .download(document.file_path);
  if (downloadError || !file) return actionError(new Error(downloadError?.message ?? 'download_failed'));

  await logRecordAccess(scope.supabase, 'patient_documents', documentId, 'view');
  const bytes = Buffer.from(await file.arrayBuffer());
  return actionOk({ dataUrl: `data:${file.type || 'image/png'};base64,${bytes.toString('base64')}` });
}
