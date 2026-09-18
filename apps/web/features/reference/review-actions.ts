'use server';

import { revalidatePath } from 'next/cache';
import { getScopeWithAbility } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

export type ReferenceKind = 'herb' | 'formula' | 'point';

const TABLES: Record<ReferenceKind, 'herbs' | 'herb_formulas' | 'acupuncture_points'> = {
  herb: 'herbs',
  formula: 'herb_formulas',
  point: 'acupuncture_points',
};

const PATHS: Record<ReferenceKind, string> = {
  herb: '/[locale]/(app)/reference/herbs/[id]',
  formula: '/[locale]/(app)/reference/formulas/[id]',
  point: '/[locale]/(app)/reference/points/[id]',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A person's "I checked this": clears the review flag and records who and
 * when. The name is captured now, so it still reads after the account is
 * gone. Row-level security keeps it to the practitioner's own clinic; the
 * kind decides the table and nothing else.
 */
export async function approveReference(kind: ReferenceKind, id: string): Promise<ActionResult> {
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));
  const table = TABLES[kind];
  if (!table || !UUID.test(id)) return actionError(new Error('validation'));

  const name = scope.context.profile?.full_name?.trim() || null;
  const { error } = await scope.supabase
    .from(table)
    .update({
      needs_review: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: scope.context.membership.user_id,
      reviewed_by_name: name,
    })
    .eq('id', id);
  if (error) return actionError(error);

  revalidatePath(PATHS[kind], 'page');
  return actionOk();
}
