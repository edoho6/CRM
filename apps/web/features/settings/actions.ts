'use server';

import { z } from 'zod';
import {
  appointmentTypeSchema,
  patientTagSchema,
  reminderTemplateSchema,
  roomSchema,
  closurePeriodSchema,
  practitionerProfileSchema,
  scheduleExceptionSchema,
  workingHoursSchema,
} from '@clinic/domain';
import { isPaymentProviderId } from '@/features/billing/providers';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Settings mutations.
 *
 * These are the knobs a practitioner turns for their own practice rather than
 * clinical data, but they are written through the same door: validated against
 * the shared schema, scoped by the session's clinic, and never trusting an id
 * that arrived in the payload.
 */
/**
 * Creates or updates one treatment type.
 *
 * The clinic id comes from the session rather than from the payload, so a
 * crafted request cannot write a type into someone else's diary — the RLS
 * policy would refuse it anyway, and this makes the refusal unnecessary.
 */
export async function saveAppointmentType(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = appointmentTypeSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  if (id) {
    const { error } = await scope.supabase
      .from('appointment_types')
      .update(parsed.data)
      .eq('id', id);
    if (error) return actionError(error);
    return actionOk({ id });
  }

  const { data, error } = await scope.supabase
    .from('appointment_types')
    .insert({ ...parsed.data, clinic_id: scope.context.clinic.id })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * Removes a treatment type, or retires it when it is already in use.
 *
 * A type attached to a booking cannot be deleted without rewriting what
 * happened, and the foreign key says so. Rather than surface a constraint
 * violation, it is deactivated: it stops appearing in the picker and every past
 * appointment keeps its label.
 */
export async function deleteAppointmentType(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { count } = await scope.supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('appointment_type_id', id);

  if ((count ?? 0) > 0) {
    const { error } = await scope.supabase
      .from('appointment_types')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return actionError(error);
    return actionError(new Error('appointment_type_in_use_deactivated'));
  }

  const { error } = await scope.supabase.from('appointment_types').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/**
 * Chooses which company takes the money, and stores that provider's credentials.
 *
 * Credentials go into the per-provider blob rather than into columns, so trying
 * SUMIT and going back to Grow does not lose what was typed for either. They are
 * written and read on the server only; nothing here is ever sent to a browser.
 *
 * Switching provider deliberately does not deactivate the settings — a
 * practitioner changing supplier mid-year still has unpaid invoices carrying
 * payment links from the old one, and those links keep working because they live
 * on the old provider's domain.
 */
export async function savePaymentProvider(input: {
  provider: unknown;
  environment: unknown;
  credentials: Record<string, string>;
  isActive: boolean;
}): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  if (!isPaymentProviderId(input.provider)) return actionError(new Error('unknown_provider'));

  const environment = input.environment === 'production' ? 'production' : 'sandbox';

  const { data: existing } = await scope.supabase
    .from('clinic_payment_settings')
    .select('id, credentials')
    .maybeSingle<{ id: string; credentials: Record<string, unknown> | null }>();

  // Merge rather than replace: the blob holds every provider ever configured.
  const credentials = {
    ...(existing?.credentials ?? {}),
    [input.provider]: input.credentials,
  };

  const payload = {
    provider: input.provider,
    environment,
    credentials,
    is_active: input.isActive,
  };

  if (existing) {
    const { error } = await scope.supabase
      .from('clinic_payment_settings')
      .update(payload)
      .eq('id', existing.id);
    if (error) return actionError(error);
    return actionOk();
  }

  const { error } = await scope.supabase
    .from('clinic_payment_settings')
    .insert({ ...payload, clinic_id: scope.context.clinic.id });

  if (error) return actionError(error);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * When the practitioner works
 * ------------------------------------------------------------------------- */

/**
 * Replaces the whole weekly pattern in one write.
 *
 * Wholesale rather than a diff: a week is at most a dozen rows, it is edited as
 * a whole, and a partial update that leaves yesterday's Tuesday behind would be
 * a diary that quietly disagrees with the screen that set it.
 *
 * The practitioner is taken from the session. Working hours belong to a person,
 * and letting the caller name which person is how one practitioner ends up
 * editing another's diary.
 */
export async function saveWorkingHours(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  if (!Array.isArray(input)) return actionError(new Error('validation'));

  const parsed = z.array(workingHoursSchema).max(40).safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const practitionerId = scope.context.membership.user_id;

  const { error: deleteError } = await scope.supabase
    .from('practitioner_schedules')
    .delete()
    .eq('practitioner_id', practitionerId);
  if (deleteError) return actionError(deleteError);

  // An empty week is a valid answer — a practitioner who has not set hours yet,
  // or who has cleared them. Nothing to insert, and no error.
  const rows = parsed.data.filter((row) => row.is_active);
  if (rows.length === 0) return actionOk();

  const { error } = await scope.supabase.from('practitioner_schedules').insert(
    rows.map((row) => ({
      clinic_id: scope.context.clinic.id,
      practitioner_id: practitionerId,
      weekday: row.weekday,
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: true,
    })),
  );

  if (error) return actionError(error);
  return actionOk();
}

/**
 * Adds or replaces one exceptional day.
 *
 * `unique (practitioner_id, date)` means a second entry for the same day is a
 * correction rather than a duplicate, so it upserts on that pair.
 */
export async function saveScheduleException(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = scheduleExceptionSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('schedule_exceptions').upsert(
    {
      clinic_id: scope.context.clinic.id,
      practitioner_id: scope.context.membership.user_id,
      date: parsed.data.date,
      is_closed: parsed.data.is_closed,
      // A closed day carries no hours: sending them would fail the database's
      // own check, which says the same thing.
      start_time: parsed.data.is_closed ? null : parsed.data.start_time,
      end_time: parsed.data.is_closed ? null : parsed.data.end_time,
      reason: parsed.data.reason,
    },
    { onConflict: 'practitioner_id,date' },
  );

  if (error) return actionError(error);
  return actionOk();
}

export async function deleteScheduleException(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('schedule_exceptions').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/**
 * Closes the diary over a stretch of days — a holiday, a course, a week off.
 *
 * Written as one row per day, upserted on `(practitioner_id, date)`. Upserted
 * rather than inserted because closing the same fortnight twice is something a
 * person does, and the second attempt should update the reason rather than fail
 * on a unique constraint.
 *
 * Dates are stepped through as UTC calendar days. Adding 24 hours to a local
 * date lands on the same day twice across a daylight-saving change, and Israel
 * moves its clocks — a March holiday would come out with a day missing.
 */
export async function closeDiaryPeriod(input: unknown): Promise<ActionResult<{ days: number }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = closurePeriodSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  /*
   * Hours given means the day is *not* closed — it is open at different hours.
   *
   * That is what `schedule_exceptions` means by the two together, and the
   * table's own CHECK enforces it: `is_closed` with times is a contradiction.
   * The distinction is real on screen too — a closed day is shaded out of the
   * calendar, a shortened one is shaded only outside the hours that remain.
   */
  const partial = parsed.data.start_time !== null && parsed.data.end_time !== null;

  const rows: {
    clinic_id: string;
    practitioner_id: string;
    date: string;
    is_closed: boolean;
    start_time: string | null;
    end_time: string | null;
    reason: string | null;
  }[] = [];

  for (
    let day = new Date(`${parsed.data.from}T00:00:00Z`);
    day <= new Date(`${parsed.data.to}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    rows.push({
      clinic_id: scope.context.clinic.id,
      practitioner_id: scope.context.membership.user_id,
      date: day.toISOString().slice(0, 10),
      is_closed: !partial,
      start_time: partial ? parsed.data.start_time : null,
      end_time: partial ? parsed.data.end_time : null,
      reason: parsed.data.reason || null,
    });
  }

  const { error } = await scope.supabase
    .from('schedule_exceptions')
    .upsert(rows, { onConflict: 'practitioner_id,date' });

  if (error) return actionError(error);
  return actionOk({ days: rows.length });
}

/**
 * Reopens a stretch of days in one go.
 *
 * The list groups consecutive closed days into one row, so removing one has to
 * remove the whole run — deleting a fortnight one day at a time is not a thing
 * to ask of anybody.
 */
export async function reopenDiaryPeriod(from: string, to: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return actionError(new Error('validation'));
  }

  const { error } = await scope.supabase
    .from('schedule_exceptions')
    .delete()
    .eq('practitioner_id', scope.context.membership.user_id)
    .gte('date', from)
    .lte('date', to);

  if (error) return actionError(error);
  return actionOk();
}

/**
 * The practitioner's own details.
 *
 * Writes to their own profile row and nowhere else: `profiles` is keyed by the
 * auth user, so the id comes from the session rather than from the form. There
 * is no version of this action that can edit a colleague's record.
 *
 * The qualification columns have been in the schema since the first milestone
 * with no screen. They matter now because a treatment confirmation is worthless
 * to a health fund without them.
 */
export async function savePractitionerProfile(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = practitionerProfileSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', scope.context.membership.user_id);

  if (error) return actionError(error);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * Rooms
 * ------------------------------------------------------------------------ */

export async function saveRoom(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  if (id) {
    const { error } = await scope.supabase.from('rooms').update(parsed.data).eq('id', id);
    if (error) return actionError(error);
    return actionOk({ id });
  }

  const { data, error } = await scope.supabase
    .from('rooms')
    .insert({ ...parsed.data, clinic_id: scope.context.clinic.id })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * Removes a room, or retires it once bookings refer to it.
 *
 * Same reasoning as a treatment type: a room that has held appointments is
 * part of what happened, and the calendar of last March should still say
 * where. It stops being offered and keeps its name on every past booking.
 */
export async function deleteRoom(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { count } = await scope.supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', id);

  if ((count ?? 0) > 0) {
    const { error } = await scope.supabase.from('rooms').update({ is_active: false }).eq('id', id);
    if (error) return actionError(error);
    return actionError(new Error('room_in_use_deactivated'));
  }

  const { error } = await scope.supabase.from('rooms').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * Patient tags
 * ------------------------------------------------------------------------ */

export async function savePatientTag(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientTagSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  if (id) {
    const { error } = await scope.supabase.from('patient_tags').update(parsed.data).eq('id', id);
    if (error) return actionError(error);
    return actionOk({ id });
  }

  const { data, error } = await scope.supabase
    .from('patient_tags')
    .insert({ ...parsed.data, clinic_id: scope.context.clinic.id })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * Deleting a tag takes it off every file that carried it — the link table
 * cascades — so the confirmation in the UI says how many that is.
 */
export async function deletePatientTag(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('patient_tags').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * Reminder wording
 * ------------------------------------------------------------------------ */

export async function saveReminderTemplate(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = reminderTemplateSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinics')
    .update({ reminder_template: parsed.data.reminder_template })
    .eq('id', scope.context.clinic.id);

  if (error) return actionError(error);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * Calendar feed
 * ------------------------------------------------------------------------ */

/**
 * The practitioner's feed row, created on first request.
 *
 * Made lazily rather than at sign-up, so a token exists only for someone who
 * has asked to subscribe — and only they can read it back, by policy.
 */
export async function ensureCalendarFeed(): Promise<ActionResult<{ token: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const practitionerId = scope.context.membership.user_id;

  const { data: existing } = await scope.supabase
    .from('calendar_feeds')
    .select('token')
    .eq('practitioner_id', practitionerId)
    .maybeSingle<{ token: string }>();

  if (existing) return actionOk({ token: existing.token });

  const { data, error } = await scope.supabase
    .from('calendar_feeds')
    .insert({ clinic_id: scope.context.clinic.id, practitioner_id: practitionerId })
    .select('token')
    .single<{ token: string }>();

  if (error) return actionError(error);
  return actionOk({ token: data.token });
}

/**
 * A new token, which is how a leaked URL is revoked: the old address returns
 * nothing from the moment this commits. Every subscribed device must be given
 * the new link, and the UI says so before this is called.
 */
export async function regenerateCalendarFeed(): Promise<ActionResult<{ token: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase
    .from('calendar_feeds')
    .update({ token: crypto.randomUUID(), last_fetched_at: null })
    .eq('practitioner_id', scope.context.membership.user_id)
    .select('token')
    .single<{ token: string }>();

  if (error) return actionError(error);
  return actionOk({ token: data.token });
}
