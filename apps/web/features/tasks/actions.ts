'use server';

import { clinicTaskSchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * The reminder offset is a column added in September 2026. A database that
 * has not run that migration yet rejects the whole write for the one column
 * it does not know (42703), and the person just sees "something went wrong"
 * over a task they typed. Until the migration is in, the write is repeated
 * without the column — a task saved without its offset beats no task at all.
 */
function unknownColumn(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42703' || /remind_offset_minutes/.test(error?.message ?? '');
}

function withoutOffset<T extends { remind_offset_minutes?: number }>(row: T): Omit<T, 'remind_offset_minutes'> {
  const { remind_offset_minutes: _dropped, ...rest } = row;
  return rest;
}

/**
 * The to-do list.
 *
 * Four verbs and nothing else: add, tick, untick, remove. Every feature beyond
 * that — assigning, scheduling, nesting — turns a list you clear into a thing
 * you maintain, and the sticky note this replaces has none of them.
 */

export async function createTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = clinicTaskSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const row = {
    ...parsed.data,
    clinic_id: scope.context.clinic.id,
    created_by: scope.context.membership.user_id,
  };
  let result = await scope.supabase.from('clinic_tasks').insert(row).select('id').single<{ id: string }>();
  if (result.error && unknownColumn(result.error)) {
    result = await scope.supabase.from('clinic_tasks').insert(withoutOffset(row)).select('id').single<{ id: string }>();
  }
  if (result.error) return actionError(result.error);
  return actionOk({ id: result.data.id });
}

/**
 * Ticks a task off, or puts it back.
 *
 * Untick exists because the tick is one click with no confirmation, and a list
 * you can only clear in one direction is one people stop trusting themselves
 * with.
 */
export async function setTaskDone(id: string, done: boolean): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('clinic_tasks')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}

export async function updateTask(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = clinicTaskSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  /*
   * A task moved to a later moment rings again at that moment.
   *
   * `reminded_at` is what keeps an alert from firing twice, and it was never
   * cleared: a task whose alert had gone off — or had been set a minute ahead
   * to try it — stayed silent at its new time forever, and all it did was add
   * to the number on the bell. Only when the new moment is still ahead, so
   * editing the notes of a task that is already late does not ring it again.
   */
  const moment = parsed.data.due_at
    ? new Date(parsed.data.due_at).getTime() - parsed.data.remind_offset_minutes * 60_000
    : null;
  const row = moment !== null && moment > Date.now() ? { ...parsed.data, reminded_at: null } : parsed.data;

  let { error } = await scope.supabase.from('clinic_tasks').update(row).eq('id', id);
  if (error && unknownColumn(error)) {
    ({ error } = await scope.supabase.from('clinic_tasks').update(withoutOffset(row)).eq('id', id));
  }
  if (error) return actionError(error);
  return actionOk();
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('clinic_tasks').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/** A task whose moment is here or near, for the bell. */
export interface DueTask {
  id: string;
  title: string;
  due_at: string;
  remind_offset_minutes: number;
  is_urgent: boolean;
  remind_via: string;
  reminded_at: string | null;
  patient: { id: string; full_name: string } | null;
}

/**
 * What the bell shows: open tasks due within the hour, overdue ones first.
 *
 * Polled from the shell every minute while the app is open. A task is "due"
 * by its instant, not its day — the day list is the dashboard's, this is
 * the alarm's.
 */
export async function dueTasks(): Promise<ActionResult<DueTask[]>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const horizon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const columns = 'id, title, due_at, is_urgent, remind_via, reminded_at, patient:patients(id, full_name)';
  const ask = (withOffset: boolean) =>
    scope.supabase
      .from('clinic_tasks')
      .select(withOffset ? columns.replace('due_at,', 'due_at, remind_offset_minutes,') : columns)
    .is('done_at', null)
    .not('due_at', 'is', null)
    .lte('due_at', horizon)
    .order('due_at', { ascending: true })
    .limit(20)
    .returns<DueTask[]>();
  let { data, error } = await ask(true);
  // Before the offset migration the column is unknown; the bell must still ring.
  if (error && unknownColumn(error)) ({ data, error } = await ask(false));

  if (error) return actionError(error);
  return actionOk((data ?? []).map((task) => ({ ...task, remind_offset_minutes: task.remind_offset_minutes ?? 0 })));
}

/**
 * Records that the alert went off, so it goes off once — not on every poll,
 * and not again in a second open tab.
 */
export async function markTaskReminded(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('clinic_tasks')
    .update({ reminded_at: new Date().toISOString() })
    .eq('id', id)
    .is('reminded_at', null);

  if (error) return actionError(error);
  return actionOk();
}
