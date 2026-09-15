'use server';

import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * The message queue, from the app's side.
 *
 * Queueing is the database's job, on the hour; sending is a provider's, or a
 * person's. The app only does two things: asks the queue to fill itself now
 * (so the Messages screen is never an hour behind), and records that a
 * message went out by hand.
 */

/** The app's public address, for the confirmation link in each reminder. */
function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000';
}

export async function refreshMessageQueue(): Promise<ActionResult<{ queued: number }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  // One function, for this clinic only. The three jobs behind it run over every
  // clinic at once and belong to the schedule; a member reaches them only
  // through this door, which pins the clinic to their own (migration 68).
  // Before that, pressing this button queued messages for every clinic in the
  // service, with the link domain taken from whoever pressed it.
  const { data, error } = await scope.supabase.rpc('enqueue_now_for_my_clinic', {
    p_base_url: baseUrl(),
  });
  if (error) return actionError(error);
  return actionOk({ queued: Number(data ?? 0) });
}

/**
 * Sent by hand — from WhatsApp, from the phone, from wherever. One function
 * in the database marks the log row and the appointment together, so the dot
 * in the diary and the queue can never disagree.
 */
export async function markMessageSent(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase.rpc('mark_message_sent', {
    p_id: id,
    p_provider: 'manual',
  });
  if (error) return actionError(error);
  if (data !== true) return actionError(new Error('not_found'));
  return actionOk();
}

/**
 * Dropped without sending — the patient rang, or the message is wrong. A
 * message the service refused can be dropped the same way, once its reason
 * has been read.
 */
export async function skipMessage(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('message_log')
    .update({ status: 'skipped', error_code: 'skipped_by_staff' })
    .eq('id', id)
    .in('status', ['queued', 'failed']);
  if (error) return actionError(error);
  return actionOk();
}
