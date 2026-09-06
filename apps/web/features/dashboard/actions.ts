'use server';

import { createServerSupabase } from '@clinic/db';
import type { DashboardLayout } from '@clinic/domain/widgets';
import { getMembershipContext } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Persists one user's dashboard arrangement.
 *
 * Upsert on (clinic, user, name) so the first save creates the row and every later
 * save overwrites it — no separate "has this user got a layout yet?" round trip.
 */
export async function saveDashboardLayout(layout: DashboardLayout): Promise<ActionResult> {
  const context = await getMembershipContext();
  if (!context) {
    return actionError(new Error('unauthorized'));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('dashboard_layouts').upsert(
    {
      clinic_id: context.clinic.id,
      user_id: context.membership.user_id,
      name: 'default',
      layout,
    },
    { onConflict: 'clinic_id,user_id,name' },
  );

  if (error) return actionError(error);
  return actionOk();
}
