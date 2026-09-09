'use server';

import { clinicTaskSchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

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

  const { data, error } = await scope.supabase
    .from('clinic_tasks')
    .insert({
      ...parsed.data,
      clinic_id: scope.context.clinic.id,
      created_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
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

  const { error } = await scope.supabase.from('clinic_tasks').update(parsed.data).eq('id', id);
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
  const { data, error } = await scope.supabase
    .from('clinic_tasks')
    .select('id, title, due_at, is_urgent, remind_via, reminded_at, patient:patients(id, full_name)')
    .is('done_at', null)
    .not('due_at', 'is', null)
    .lte('due_at', horizon)
    .order('due_at', { ascending: true })
    .limit(20)
    .returns<DueTask[]>();

  if (error) return actionError(error);
  return actionOk(data ?? []);
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
