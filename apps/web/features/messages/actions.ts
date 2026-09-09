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

  const [{ data: reminders, error }, { data: alerts, error: alertsError }] = await Promise.all([
    scope.supabase.rpc('enqueue_due_reminders', { p_base_url: baseUrl() }),
    scope.supabase.rpc('enqueue_due_task_alerts'),
  ]);
  if (error) return actionError(error);
  if (alertsError) return actionError(alertsError);
  return actionOk({ queued: Number(reminders ?? 0) + Number(alerts ?? 0) });
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

/** Dropped from the queue without sending — the patient rang, or the message is wrong. */
export async function skipMessage(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('message_log')
    .update({ status: 'skipped', error_code: 'skipped_by_staff' })
    .eq('id', id)
    .eq('status', 'queued');
  if (error) return actionError(error);
  return actionOk();
}
