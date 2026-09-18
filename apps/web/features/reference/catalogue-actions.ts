'use server';

import { revalidatePath } from 'next/cache';
import { getScopeWithAbility } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/** What the load reports back: rows added now, and totals after it. */
export interface CatalogueLoadResult {
  herbs_added: number;
  formulas_added: number;
  items_added: number;
  points_added: number;
  herbs: number;
  formulas: number;
  points: number;
  catalogue_herbs: number;
  catalogue_formulas: number;
  catalogue_points: number;
}

/**
 * Copies the shared catalogue into this clinic (clinic_load_catalogue,
 * migration 56): inserts what is missing, fills only empty fields, never
 * overwrites a correction. Safe to press twice.
 */
/** What the refresh reports back: the load it ran first, and what it rewrote. */
export interface CatalogueRefreshResult {
  loaded: CatalogueLoadResult;
  herbs_refreshed: number;
  formulas_refreshed: number;
  items_replaced: number;
  points_refreshed: number;
}

/**
 * Brings this clinic up to date with the catalogue's facts-based text
 * (clinic_refresh_catalogue_text, migration 57): loads what is missing, then
 * rewrites every entry nobody has approved. Approved and hand-edited rows
 * are left alone.
 */
export async function refreshReferenceCatalogueText(): Promise<
  ActionResult<CatalogueRefreshResult>
> {
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase.rpc('clinic_refresh_catalogue_text');
  if (error) return actionError(error);

  revalidatePath('/[locale]/(app)/settings', 'page');
  revalidatePath('/[locale]/(app)/reference/herbs', 'page');
  revalidatePath('/[locale]/(app)/reference/formulas', 'page');
  revalidatePath('/[locale]/(app)/reference/points', 'page');
  return actionOk(data as CatalogueRefreshResult);
}

export async function loadReferenceCatalogue(): Promise<ActionResult<CatalogueLoadResult>> {
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase.rpc('clinic_load_catalogue');
  if (error) return actionError(error);

  revalidatePath('/[locale]/(app)/settings', 'page');
  revalidatePath('/[locale]/(app)/reference/herbs', 'page');
  revalidatePath('/[locale]/(app)/reference/formulas', 'page');
  revalidatePath('/[locale]/(app)/reference/points', 'page');
  return actionOk(data as CatalogueLoadResult);
}
