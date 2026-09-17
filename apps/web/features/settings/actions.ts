'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import {
  AUTOMATION_KINDS,
  appointmentTypeSchema,
  automationSettingsSchema,
  googleReviewUrlSchema,
  patientTagSchema,
  reminderSettingsSchema,
  roomSchema,
  locationSchema,
  bookingSettingsSchema,
  patientChangesSchema,
  patientVisibilitySchema,
  scheduleBlocksSchema,
  closurePeriodSchema,
  practitionerProfileSchema,
  scheduleExceptionSchema,
  whatsappLineSchema,
  workingHoursSchema,
  HOME_PATHS,
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

/** Where the clinic name leads for this person. Refused unless it is one of the known screens. */
export async function saveHomePath(path: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  if (typeof path !== 'string' || !(HOME_PATHS as readonly string[]).includes(path)) {
    return actionError(new Error('validation'));
  }
  const { error } = await scope.supabase
    .from('profiles')
    .update({ home_path: path })
    .eq('id', scope.context.membership.user_id);
  if (error) return actionError(error);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * Rooms
 * ------------------------------------------------------------------------ */

export async function saveRoom(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
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

export async function saveReminderSettings(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = reminderSettingsSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinics')
    .update({
      reminder_template: parsed.data.reminder_template,
      reminders_enabled: parsed.data.reminders_enabled,
      reminder_hours_before: parsed.data.reminder_hours_before,
      reminder_channel: parsed.data.reminder_channel,
      reminder_push_enabled: parsed.data.reminder_push_enabled,
    })
    .eq('id', scope.context.clinic.id);

  if (error) return actionError(error);

  // The reminder's WhatsApp template lives with the other automations' —
  // one table the sender reads for every kind — under the reminder's own key.
  const { error: templateError } = await scope.supabase.from('clinic_automations').upsert(
    {
      clinic_id: scope.context.clinic.id,
      kind: 'appointment_reminder',
      whatsapp_template_id: parsed.data.whatsapp_template_id,
    },
    { onConflict: 'clinic_id,kind' },
  );
  if (templateError) return actionError(templateError);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * The automated messages
 * ------------------------------------------------------------------------ */

/**
 * One automation's settings. The kind is checked against the four the
 * database knows, and the clinic is the session's: a crafted request cannot
 * switch a message on for someone else's patients.
 */
export async function saveAutomation(kind: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  if (!(AUTOMATION_KINDS as readonly string[]).includes(kind))
    return actionError(new Error('validation'));
  const parsed = automationSettingsSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinic_automations')
    .upsert(
      { clinic_id: scope.context.clinic.id, kind, ...parsed.data },
      { onConflict: 'clinic_id,kind' },
    );
  if (error) return actionError(error);
  return actionOk();
}

/**
 * The clinic's WhatsApp line and the template that opens a conversation.
 * The number is the clinic's own row; the template id lives with the other
 * automations' under its own kind, read by the composer and the sender.
 */
export async function saveWhatsappLine(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = whatsappLineSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinics')
    .update({ whatsapp_number: parsed.data.whatsapp_number })
    .eq('id', scope.context.clinic.id);
  if (error) return actionError(error);

  const { error: openerError } = await scope.supabase
    .from('clinic_automations')
    .upsert(
      {
        clinic_id: scope.context.clinic.id,
        kind: 'conversation_opener',
        whatsapp_template_id: parsed.data.opener_template_id,
      },
      { onConflict: 'clinic_id,kind' },
    );
  if (openerError) return actionError(openerError);
  return actionOk();
}

export async function saveGoogleReviewUrl(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = googleReviewUrlSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinics')
    .update({ google_review_url: parsed.data.google_review_url })
    .eq('id', scope.context.clinic.id);
  if (error) return actionError(error);
  return actionOk();
}

const TEST_CHANNELS = ['sms', 'whatsapp', 'email'] as const;

/**
 * A message to yourself, queued like any other.
 *
 * It goes to the practitioner's own phone (or, by email, their own address),
 * never to a patient, and the sender lets it through even from a clinic
 * marked as a sandbox — it is how you find out the service is connected.
 */
export async function sendTestMessage(channel: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  if (!(TEST_CHANNELS as readonly unknown[]).includes(channel))
    return actionError(new Error('validation'));
  const via = channel as (typeof TEST_CHANNELS)[number];

  let recipient: string | null = null;
  if (via === 'email') {
    const { data } = await scope.supabase.auth.getUser();
    recipient = data.user?.email ?? null;
  } else {
    recipient = scope.context.profile?.phone?.trim() || null;
  }
  if (!recipient) return actionError(new Error('no_recipient'));

  const clinic = scope.context.clinic;
  const t = await getTranslations('settings.messaging.test');
  const { error } = await scope.supabase.from('message_log').insert({
    clinic_id: clinic.id,
    channel: via,
    template_key: 'test_message',
    recipient,
    body: t('body', { clinic: clinic.name }),
    subject: via === 'email' ? clinic.name : null,
    params: [clinic.name],
    status: 'queued',
  });
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

/* ---------------------------------------------------------------------------
 * Blocked hours
 * ------------------------------------------------------------------------ */

/**
 * Several windows on one day, in one go: the dialog collects them and sends
 * them together, so "14:00–15:00 dentist, 16:00–17:00 school run" is one save.
 */
export async function addScheduleBlocks(input: unknown): Promise<ActionResult<{ count: number }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = scheduleBlocksSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const rows = parsed.data.map((window) => ({
    clinic_id: scope.context.clinic.id,
    practitioner_id: scope.context.membership.user_id,
    start_at: new Date(window.start_at).toISOString(),
    end_at: new Date(window.end_at).toISOString(),
    reason: window.reason,
  }));

  const { error } = await scope.supabase.from('schedule_blocks').insert(rows);
  if (error) return actionError(error);
  return actionOk({ count: rows.length });
}

export async function deleteScheduleBlock(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('schedule_blocks')
    .delete()
    .eq('id', id)
    .eq('practitioner_id', scope.context.membership.user_id);
  if (error) return actionError(error);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * Locations
 * ------------------------------------------------------------------------ */

export async function saveLocation(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const row = {
    clinic_id: scope.context.clinic.id,
    name: parsed.data.name,
    address: parsed.data.address,
    color: parsed.data.color,
    is_active: parsed.data.is_active,
  };

  const query = id
    ? scope.supabase
        .from('locations')
        .update(row)
        .eq('id', id)
        .select('id')
        .single<{ id: string }>()
    : scope.supabase.from('locations').insert(row).select('id').single<{ id: string }>();

  const { data, error } = await query;
  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * A location with bookings or rooms in it is retired rather than removed, so
 * the diary keeps saying where those bookings were.
 */
export async function deleteLocation(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const [{ count: bookings }, { count: rooms }] = await Promise.all([
    scope.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', id),
    scope.supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('location_id', id),
  ]);

  if ((bookings ?? 0) > 0 || (rooms ?? 0) > 0) {
    const { error } = await scope.supabase
      .from('locations')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return actionError(error);
    return actionError(new Error('location_in_use_deactivated'));
  }

  const { error } = await scope.supabase.from('locations').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/* ---------------------------------------------------------------------------
 * Online booking
 * ------------------------------------------------------------------------ */

export async function saveBookingSettings(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = bookingSettingsSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinics')
    .update({
      booking_enabled: parsed.data.booking_enabled,
      booking_slug: parsed.data.booking_slug,
      booking_intro: parsed.data.booking_intro,
      booking_lead_hours: parsed.data.booking_lead_hours,
      booking_horizon_days: parsed.data.booking_horizon_days,
      booking_verify_sms: parsed.data.booking_verify_sms,
    })
    .eq('id', scope.context.clinic.id);

  // The handle is a URL shared by the whole service; a taken one is the one
  // thing this form can be wrong about.
  if (error?.code === '23505') return actionError(new Error('slug_taken'));
  if (error) return actionError(error);
  return actionOk();
}

/** Moving and cancelling from the reminder link: a card of its own, since a clinic without the booking page may want cancelling alone. */
/**
 * How the clinic shares its patients (migration 78). The owner alone reaches
 * this — the policy on `clinics` has said so since the first migration — and
 * the schema keeps the column to the two values the database will accept.
 */
export async function savePatientVisibility(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientVisibilitySchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinics')
    .update({ patient_visibility: parsed.data.patient_visibility })
    .eq('id', scope.context.clinic.id);
  if (error) return actionError(error);
  return actionOk();
}

export async function savePatientChangesSettings(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientChangesSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinics')
    .update({
      patient_changes_enabled: parsed.data.patient_changes_enabled,
      patient_changes_notice_hours: parsed.data.patient_changes_notice_hours,
    })
    .eq('id', scope.context.clinic.id);
  if (error) return actionError(error);
  return actionOk();
}
