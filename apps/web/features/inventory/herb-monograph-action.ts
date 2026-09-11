'use server';

import type { Herb } from '@clinic/db/types';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * The monograph behind a photograph, for the gallery's pop-up.
 *
 * Read on demand rather than shipped with the gallery's list: that list
 * holds every herb with a picture and only its names, and a monograph is a
 * page of text. The herbs table is clinic-scoped, so the policies decide
 * what comes back — another clinic's herb is simply not found.
 */
export async function loadHerbMonograph(id: string): Promise<ActionResult<Herb>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase.from('herbs').select('*').eq('id', id).maybeSingle<Herb>();
  if (error) return actionError(error);
  if (!data) return actionError(new Error('not_found'));
  return actionOk(data);
}
