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
