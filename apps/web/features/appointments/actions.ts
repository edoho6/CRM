'use server';

import {
  appointmentFormSchema,
  appointmentMoveSchema,
  appointmentSeriesSchema,
  dateKeyIn,
  type AppointmentStatus,
} from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import { isClosedDay, type DayException, type WorkingBlock } from './availability';
import { seriesDates } from './series';

/**
 * Appointment mutations.
 *
 * None of these check for a clashing booking first. The database enforces that with
 * an exclusion constraint, so a clash comes back as error 23P01 and is translated
 * into "this practitioner already has an overlapping appointment". Checking in
 * application code as well would add a race window without adding safety.
 */

export async function createAppointment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = appointmentFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('appointments')
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

/** What happened to one date in a series. */
export interface SeriesOutcome {
  start_at: string;
  reason: 'closed' | 'overlap' | 'failed';
}

export interface SeriesResult {
  created: number;
  skipped: SeriesOutcome[];
}

/**
 * A course of treatment: the same appointment repeated every N weeks, M times.
 *
 * Booked one row at a time rather than as a single multi-row insert, and this is
 * the whole point of the feature. `appointments_no_overlap` is an exclusion
 * constraint, so one clashing date in a batch insert would roll back the entire
 * statement — a practitioner booking ten weekly sessions would get nothing
 * because week six is already taken. Ten statements means nine bookings and one
 * line saying which date needs a different hour.
 *
 * Closed days are skipped rather than booked, because a series is set up once and
 * not looked at again; a session quietly scheduled on a holiday would be found by
 * the patient arriving at a locked door. Skipped dates come back in the report so
 * they can be placed by hand.
 *
 * The first occurrence is the appointment in the dialog. `input` has already been
 * through the same schema as a single booking.
 */
export async function createAppointmentSeries(
  input: unknown,
  series: unknown,
): Promise<ActionResult<SeriesResult>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = appointmentFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const parsedSeries = appointmentSeriesSchema.safeParse(series);
  if (!parsedSeries.success) return actionError(new Error('validation'));

  const { every_weeks: everyWeeks, occurrences } = parsedSeries.data;

  const firstStart = new Date(parsed.data.start_at);
  const firstEnd = new Date(parsed.data.end_at);
  if (Number.isNaN(firstStart.getTime()) || Number.isNaN(firstEnd.getTime())) {
    return actionError(new Error('validation'));
  }

  // On the clinic's clock, so a series that crosses a change of summer time
  // keeps its hour (series.ts, with tests on both 2026 changes).
  const timeZone = scope.context.clinic.timezone;
  const dates = seriesDates(firstStart, firstEnd, everyWeeks, occurrences, timeZone);

  // Only the exceptions that could fall inside the series, not the whole table.
  const lastDate = dates[dates.length - 1]!.start;
  const [blocksResult, exceptionsResult] = await Promise.all([
    scope.supabase
      .from('practitioner_schedules')
      .select('weekday, start_time, end_time')
      .eq('practitioner_id', parsed.data.practitioner_id)
      .eq('is_active', true)
      .returns<WorkingBlock[]>(),
    scope.supabase
      .from('schedule_exceptions')
      .select('date, is_closed, start_time, end_time, reason')
      .eq('practitioner_id', parsed.data.practitioner_id)
      .gte('date', dateKeyIn(firstStart, timeZone))
      .lte('date', dateKeyIn(lastDate, timeZone))
      .returns<DayException[]>(),
  ]);

  const availability = {
    blocks: blocksResult.data ?? [],
    exceptions: exceptionsResult.data ?? [],
  };

  const skipped: SeriesOutcome[] = [];
  let created = 0;

  for (const { start, end } of dates) {
    if (isClosedDay(start, availability)) {
      skipped.push({ start_at: start.toISOString(), reason: 'closed' });
      continue;
    }

    const { error } = await scope.supabase.from('appointments').insert({
      ...parsed.data,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      clinic_id: scope.context.clinic.id,
      created_by: scope.context.membership.user_id,
    });

    if (!error) {
      created += 1;
      continue;
    }

    // 23P01 is the exclusion constraint: that hour is already taken. Anything
    // else is reported as itself rather than dressed up as a clash.
    skipped.push({
      start_at: start.toISOString(),
      reason: error.code === '23P01' ? 'overlap' : 'failed',
    });
  }

  return actionOk({ created, skipped });
}

export async function updateAppointment(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = appointmentFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('appointments')
    .update(parsed.data)
    .eq('id', id)
    .select('id');

  if (error) return actionError(error);
  // No row back: the rules refused it or it is gone. Not "saved".
  if (!data?.length) return actionError(new Error('not_found'));
  return actionOk();
}

/**
 * A booking dragged to another hour or day: only the times change. The
 * clash rules are the exclusion constraints, as for any other write — a
 * drop on a taken hour comes back as the same overlap error the dialog
 * shows, and the block returns to where it was.
 */
export async function moveAppointment(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = appointmentMoveSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('appointments')
    .update(parsed.data)
    .eq('id', id)
    .select('id');

  if (error) return actionError(error);
  // No row back: the rules refused it or it is gone. Not "saved".
  if (!data?.length) return actionError(new Error('not_found'));
  return actionOk();
}

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  cancelledReason?: string | null,
): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase
    .from('appointments')
    .update({
      status,
      // The database trigger stamps cancelled_at and clears both fields when a
      // booking is un-cancelled, so only the reason is set here.
      cancelled_reason: status === 'cancelled' ? (cancelledReason ?? null) : null,
    })
    .eq('id', id)
    .select('id');

  if (error) return actionError(error);
  // No row back: the rules refused it or it is gone. Not "saved".
  if (!data?.length) return actionError(new Error('not_found'));
  return actionOk();
}

export async function deleteAppointment(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) return actionError(error);
  // No row back: the rules refused it or it is gone. Not "saved".
  if (!data?.length) return actionError(new Error('not_found'));
  return actionOk();
}

/**
 * Stamps the moment a reminder went out.
 *
 * The sending itself happens elsewhere — today by opening WhatsApp with the
 * text ready — so this is the only part the database can know about. Called
 * from the click that opens the message, not from any confirmation that it
 * arrived: a practitioner who opened the chat and then thought better of it
 * can clear the mark from the same place.
 */
export async function markReminderSent(id: string, sent: boolean): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase
    .from('appointments')
    .update({ reminder_sent_at: sent ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id');

  if (error) return actionError(error);
  // No row back: the rules refused it or it is gone. Not "saved".
  if (!data?.length) return actionError(new Error('not_found'));
  return actionOk();
}

/**
 * The desk answering on the patient's behalf — they rang, they said yes.
 *
 * Writes the same two fields the patient's own tap writes, so the calendar
 * cannot tell the difference and does not need to. `null` takes the answer
 * back to "not heard", for the message that turned out to be about a
 * different week.
 */
export async function setConfirmationResponse(
  id: string,
  response: 'confirmed' | 'declined' | null,
): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase
    .from('appointments')
    .update({
      confirmation_response: response,
      responded_at: response ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id');

  if (error) return actionError(error);
  // No row back: the rules refused it or it is gone. Not "saved".
  if (!data?.length) return actionError(new Error('not_found'));
  return actionOk();
}
