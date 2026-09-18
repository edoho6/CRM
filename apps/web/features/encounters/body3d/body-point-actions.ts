'use server';

import { bodyPointSchema } from '@clinic/domain';
import { getScopeWithAbility } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Writing a point's place on the 3D body.
 *
 * The rows are service-wide, so only a platform admin may write them; the
 * database function checks that itself (body_point_set, migration 56) and
 * the check here only spares a round trip. Nothing about a patient passes
 * through: a code and six numbers.
 */
export async function saveBodyPoint(input: unknown): Promise<ActionResult> {
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));
  if (!scope.context.isPlatformAdmin) return actionError(new Error('forbidden'));

  const parsed = bodyPointSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));
  const value = parsed.data;

  const { error } = await scope.supabase.rpc('body_point_set', {
    p_code: value.code,
    p_side_type: value.sideType,
    p_x: value.position.x,
    p_y: value.position.y,
    p_z: value.position.z,
    p_approach_x: value.approach?.x ?? null,
    p_approach_y: value.approach?.y ?? null,
    p_approach_z: value.approach?.z ?? null,
    p_validated: value.validated,
    p_note: value.note ?? null,
  });
  if (error) return actionError(error);
  return actionOk();
}

export async function deleteBodyPoint(code: unknown): Promise<ActionResult> {
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));
  if (!scope.context.isPlatformAdmin) return actionError(new Error('forbidden'));
  if (typeof code !== 'string' || !/^[A-Za-z]{1,4}\d{1,3}$/.test(code.trim())) {
    return actionError(new Error('validation'));
  }

  const { error } = await scope.supabase.rpc('body_point_delete', { p_code: code.trim().toUpperCase() });
  if (error) return actionError(error);
  return actionOk();
}
