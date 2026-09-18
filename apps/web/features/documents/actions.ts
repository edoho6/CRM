'use server';

import { randomUUID } from 'node:crypto';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Patient document storage.
 *
 * Files live in the private `patient-documents` bucket under
 * `<clinic_id>/<patient_id>/<random>-<original-name>`, matching the path
 * convention the storage RLS policies (supabase/migrations) already expect. A
 * random prefix avoids two same-named uploads colliding and keeps the storage
 * key from leaking the original filename to anything that only sees the path.
 *
 * Validation here is deliberately manual rather than zod: a `File` from
 * `FormData` doesn't round-trip cleanly through zod's schema model, and the two
 * checks that matter (is it present, is the category one we know) are simple
 * enough to just write out.
 */

const MAX_FILE_BYTES = 15 * 1024 * 1024; // matches next.config.ts serverActions.bodySizeLimit

function sanitiseFileName(name: string): string {
  const trimmed = name.trim().slice(-120);
  return trimmed.replace(/[^\w.\-֐-׿ ]+/g, '_') || 'document';
}

function isDocumentCategory(value: unknown): value is DocumentCategory {
  return typeof value === 'string' && (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export async function uploadDocument(
  patientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return actionError(new Error('file_required'));
  }
  if (file.size > MAX_FILE_BYTES) {
    return actionError(new Error('file_too_large'));
  }

  const categoryRaw = formData.get('category');
  const category: DocumentCategory = isDocumentCategory(categoryRaw) ? categoryRaw : 'other';
  const sharedWithPatient = formData.get('shared_with_patient') === 'on';
  // A photograph taken at a treatment says which one. Row-level security on
  // the insert checks the clinic; the foreign key checks the treatment exists.
  const encounterRaw = formData.get('encounter_id');
  const encounterId = typeof encounterRaw === 'string' && encounterRaw.trim() ? encounterRaw : null;

  const path = `${scope.context.clinic.id}/${patientId}/${randomUUID()}-${sanitiseFileName(file.name)}`;

  /*
   * The row first, then the file. Storage lets a file in only under a path
   * whose `patient_documents` row the caller can read (migration 20260919090000),
   * so the row is what authorises the upload — the same rule that decides who
   * may see the document decides who may store it.
   *
   * The row is marked pending until the file is stored. If the upload fails,
   * the row is removed; if even that fails, it stays marked, and the panel
   * shows it as an upload that did not complete, with a way to delete it.
   */
  const { data, error } = await scope.supabase
    .from('patient_documents')
    .insert({
      clinic_id: scope.context.clinic.id,
      patient_id: patientId,
      uploaded_by: scope.context.membership.user_id,
      file_path: path,
      file_name: file.name || 'document',
      mime_type: file.type || null,
      size_bytes: file.size,
      category,
      shared_with_patient: sharedWithPatient,
      encounter_id: encounterId,
      upload_pending: true,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);

  const { error: uploadError } = await scope.supabase.storage
    .from('patient-documents')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });

  if (uploadError) {
    const { error: cleanupError } = await scope.supabase
      .from('patient_documents')
      .delete()
      .eq('id', data.id);
    return actionError(new Error(cleanupError ? 'upload_incomplete' : 'upload_failed'));
  }

  const { error: doneError } = await scope.supabase
    .from('patient_documents')
    .update({ upload_pending: false })
    .eq('id', data.id);
  // The file is stored; a row still marked pending only means the panel will
  // offer to delete a document that is in fact complete. Said, not hidden.
  if (doneError) return actionError(new Error('upload_incomplete'));

  return actionOk({ id: data.id });
}

export async function setDocumentShared(
  documentId: string,
  shared: boolean,
): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('patient_documents')
    .update({ shared_with_patient: shared })
    .eq('id', documentId);

  if (error) return actionError(error);
  return actionOk();
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data: document, error: fetchError } = await scope.supabase
    .from('patient_documents')
    .select('file_path')
    .eq('id', documentId)
    .maybeSingle<{ file_path: string }>();

  if (fetchError) return actionError(fetchError);
  if (!document) return actionOk(); // Already gone — deleting twice should not be an error.

  /*
   * The file before the row. Storage lets a file be removed only while its
   * `patient_documents` row exists and is readable to the caller, so deleting
   * the row first would leave a file nobody may remove. Removing a path that is
   * already gone is not an error, so a retried click passes through; a real
   * refusal stops here with the row — and the file — still in place.
   *
   * A filed questionnaire has no object in storage; its path is a marker.
   */
  if (!document.file_path.startsWith('form-submission:')) {
    const { error: storageError } = await scope.supabase.storage
      .from('patient-documents')
      .remove([document.file_path]);
    if (storageError) return actionError(new Error(storageError.message));
  }

  const { error } = await scope.supabase.from('patient_documents').delete().eq('id', documentId);
  // The file is gone and the row is not: it stays listed, and opening it says
  // the file is missing — never a silent success.
  if (error) return actionError(error);
  return actionOk();
}
