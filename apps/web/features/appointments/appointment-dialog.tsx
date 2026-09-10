'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Check, MessageCircle, Trash2, X } from 'lucide-react';
import {
  Alert,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  FieldGrid,
  LtrInput,
  Select,
  Collapsible,
  Spinner,
  Textarea,
  cn,
  useConfirm,
  useToast,
  type ComboboxOption,
  type ComboboxValue,
} from '@clinic/ui';
import { APPOINTMENT_STATUSES, type AppointmentStatus, type Locale } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type {
  AppointmentType,
  AppointmentWithRelations,
  Location,
  Patient,
  Room,
} from '@clinic/db/types';
import { appointmentTypeName } from '@/lib/display';
import { whatsappNumber } from '@/components/phone-actions';
import { StartEncounterButton } from '@/features/encounters/start-encounter-button';
import {
  createAppointment,
  createAppointmentSeries,
  deleteAppointment,
  markReminderSent,
  setConfirmationResponse,
  updateAppointment,
  type SeriesResult,
} from './actions';
import {
  blockedWindowFor,
  closureFor,
  isWithinWorkingHours,
  type Availability,
} from './availability';
import { addMinutes, differenceInMinutes, toDateTimeLocalValue } from './date-utils';
import { confirmationPath, fillReminderTemplate } from './confirmation';
import { ConfirmationBadge } from './confirmation-status';
import { formatDate, formatDateTime, formatTime } from '@clinic/i18n';

export interface AppointmentDraft {
  id?: string;
  patientId?: string;
  start: Date;
  end: Date;
  typeId?: string | null;
  status?: AppointmentStatus;
  roomId?: string | null;
  locationId?: string | null;
  location?: string | null;
  notes?: string | null;
  /** The reminder trail, for an existing booking. */
  reminderSentAt?: string | null;
  confirmationToken?: string | null;
  confirmationResponse?: 'confirmed' | 'declined' | null;
  respondedAt?: string | null;
  patientPhone?: string | null;
}

/**
 * Create/edit dialog for a booking.
 *
 * Times are handled as `datetime-local` values (local wall-clock) and converted to
 * ISO instants only on submit. Binding a UTC string straight to the input would
 * show the practitioner a time that is not the one they booked.
 *
 * Where a booking happens is asked only when there is a choice: the address,
 * when the practice has more than one; the room, when it has defined any. A
 * dialog that asks "which room" of a practice with one bed is a dialog
 * asking to be ignored.
 *
 * On an existing booking the first thing is "open the treatment": that is
 * what the dialog is opened for on the day, and it belongs above the fields
 * rather than under them.
 */
export function AppointmentDialog({
  open,
  draft,
  patients,
  appointmentTypes,
  rooms,
  locations,
  practitionerId,
  availability,
  reminderTemplate,
  clinicName,
  onOpenChange,
}: {
  open: boolean;
  draft: AppointmentDraft | null;
  patients: Pick<Patient, 'id' | 'full_name' | 'phone'>[];
  appointmentTypes: AppointmentType[];
  rooms: Room[];
  locations: Location[];
  practitionerId: string;
  /** Working hours, for the out-of-hours notice. Nothing here blocks a save. */
  availability: Availability;
  /** The clinic's reminder wording; null means the built-in text. */
  reminderTemplate: string | null;
  clinicName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [patientChoice, setPatientChoice] = useState<ComboboxValue | null>(null);
  const patientId = patientChoice?.id ?? '';

  const patientOptions: ComboboxOption[] = useMemo(
    () =>
      patients.map((patient) => ({
        id: patient.id,
        label: patient.full_name,
        // Two patients can share a name; the phone number is what tells them
        // apart at the desk, so it is searchable even though it is not shown.
        keywords: patient.phone ?? undefined,
      })),
    [patients],
  );
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('scheduled');
  const [locationId, setLocationId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [notes, setNotes] = useState('');

  // A course of treatment. Only offered on a new booking: turning an existing
  // appointment into a series would have to decide what the original row means,
  // and "book ten more like this one" is a different action from "edit this".
  const [repeats, setRepeats] = useState(false);
  const [everyWeeks, setEveryWeeks] = useState('1');
  const [occurrences, setOccurrences] = useState('4');
  const [seriesResult, setSeriesResult] = useState<SeriesResult | null>(null);

  // The reminder trail is edited in place, without closing the dialog, so it
  // is held here and written back through its own actions.
  const [reminderSentAt, setReminderSentAt] = useState<string | null>(null);
  const [response, setResponse] = useState<'confirmed' | 'declined' | null>(null);
  const [respondedAt, setRespondedAt] = useState<string | null>(null);

  // The site's origin, for the confirmation link in the reminder. Read after
  // mount: reading `window` during render gives the server and the client
  // different markup for the same booking.
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const isEditing = Boolean(draft?.id);

  const activeLocations = useMemo(
    () => locations.filter((entry) => entry.is_active || entry.id === locationId),
    [locations, locationId],
  );
  const hasLocations = locations.some((entry) => entry.is_active);

  // The rooms of the chosen address, or all of them when rooms carry no
  // address; a room already on this booking stays offered even if retired.
  const activeRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          (room.is_active || room.id === roomId) &&
          (!locationId || !room.location_id || room.location_id === locationId),
      ),
    [rooms, roomId, locationId],
  );
  const hasRooms = rooms.some((room) => room.is_active);

  // Reset from the draft, and only from the draft. The lists of patients and
  // rooms change identity on every server refresh — marking a reminder sent
  // triggers one — and resetting on them wiped half-typed edits mid-dialog.
  useEffect(() => {
    if (!draft) return;
    setPatientChoice(
      draft.patientId
        ? {
            id: draft.patientId,
            label: patients.find((p) => p.id === draft.patientId)?.full_name ?? '',
          }
        : null,
    );
    // A new booking starts on the first active type: a one-type clinic used to
    // pick the same option every time, and the duration was already its.
    setTypeId(draft.typeId ?? (draft.id ? '' : (appointmentTypes.find((type) => type.is_active)?.id ?? '')));
    setStart(toDateTimeLocalValue(draft.start));
    setEnd(toDateTimeLocalValue(draft.end));
    setStatus(draft.status ?? 'scheduled');
    // A new booking goes into the first address and the first room: with
    // either defined, every booking has one, or the clash rule has nothing to
    // hold.
    const firstLocation = locations.find((entry) => entry.is_active)?.id ?? '';
    const nextLocation = draft.locationId ?? (draft.id ? '' : firstLocation);
    setLocationId(nextLocation);
    setRoomId(
      draft.roomId ??
        (draft.id
          ? ''
          : (rooms.find(
              (room) =>
                room.is_active && (!nextLocation || !room.location_id || room.location_id === nextLocation),
            )?.id ?? '')),
    );
    setNotes(draft.notes ?? '');
    setReminderSentAt(draft.reminderSentAt ?? null);
    setResponse(draft.confirmationResponse ?? null);
    setRespondedAt(draft.respondedAt ?? null);
    setErrorKey(null);
    setRepeats(false);
    setSeriesResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Changing the address drops a room that is not in it.
  useEffect(() => {
    if (!roomId) return;
    const room = rooms.find((entry) => entry.id === roomId);
    if (room?.location_id && locationId && room.location_id !== locationId) setRoomId('');
  }, [locationId, roomId, rooms]);

  const activeTypes = useMemo(
    () => appointmentTypes.filter((type) => type.is_active || type.id === typeId),
    [appointmentTypes, typeId],
  );

  /*
   * Whether this hour is one the practitioner works, and why not if not.
   *
   * A notice, never a block: they do see someone at eight in the evening, and a
   * dialog that refuses is a dialog they route around. It also stays silent when
   * no hours have been set at all — a warning on every booking because a settings
   * screen is empty is a warning nobody reads.
   */
  const outsideHours = useMemo(() => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    if (isWithinWorkingHours(startDate, endDate, availability)) return null;
    const window = blockedWindowFor(startDate, endDate, availability);
    return { reason: window?.reason ?? closureFor(startDate, availability)?.reason ?? null };
  }, [start, end, availability]);

  /** Picking a type re-ends the appointment at its default duration. */
  function handleTypeChange(nextTypeId: string) {
    setTypeId(nextTypeId);
    const type = appointmentTypes.find((entry) => entry.id === nextTypeId);
    if (!type || !start) return;
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) return;
    setEnd(toDateTimeLocalValue(addMinutes(startDate, type.default_duration_minutes)));
  }

  /** Moving the start keeps the appointment the same length. */
  function handleStartChange(nextStart: string) {
    const previousStart = new Date(start);
    const previousEnd = new Date(end);
    setStart(nextStart);

    const nextDate = new Date(nextStart);
    if (Number.isNaN(nextDate.getTime())) return;

    const duration =
      !Number.isNaN(previousStart.getTime()) && !Number.isNaN(previousEnd.getTime())
        ? differenceInMinutes(previousEnd, previousStart)
        : 60;
    setEnd(toDateTimeLocalValue(addMinutes(nextDate, Math.max(duration, 5))));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorKey(null);
    setSeriesResult(null);

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Say which field, by putting the cursor in it: "something is missing"
    // above an eleven-field form is a puzzle, not a message.
    const missing = !patientId
      ? 'patient_id'
      : Number.isNaN(startDate.getTime())
        ? 'start_at'
        : Number.isNaN(endDate.getTime())
          ? 'end_at'
          : null;
    if (missing) {
      setErrorKey('common.somethingMissing');
      document.getElementById(missing)?.focus();
      return;
    }
    if (endDate <= startDate) {
      setErrorKey('errors.endMustBeAfterStart');
      document.getElementById('end_at')?.focus();
      return;
    }
    if ((hasRooms && !roomId) || (hasLocations && !locationId)) {
      setErrorKey('common.somethingMissing');
      document.getElementById(hasLocations && !locationId ? 'location_id' : 'room_id')?.focus();
      return;
    }

    const payload = {
      patient_id: patientId,
      practitioner_id: practitionerId,
      appointment_type_id: typeId || null,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      status,
      room_id: roomId || null,
      location_id: locationId || null,
      location: draft?.location ?? '',
      notes,
    };

    startTransition(async () => {
      if (!draft?.id && repeats) {
        const result = await createAppointmentSeries(payload, {
          every_weeks: everyWeeks,
          occurrences,
        });
        if (!result.ok) {
          setErrorKey(result.error.key);
          return;
        }
        router.refresh();
        // The dialog stays open when part of the series did not fit, because
        // closing it would take the list of which dates need a different hour
        // away with it.
        if (result.data.skipped.length === 0) {
          onOpenChange(false);
          toast({ tone: 'success', title: t('created') });
          return;
        }
        setSeriesResult(result.data);
        return;
      }

      const result = draft?.id
        ? await updateAppointment(draft.id, payload)
        : await createAppointment(payload);

      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      onOpenChange(false);
      // The dialog closes on success, so the confirmation has to outlive it.
      toast({ tone: 'success', title: t(draft?.id ? 'updated' : 'created') });
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!draft?.id) return;
    const confirmed = await confirm({
      title: tc('deleteConfirmTitle'),
      body: tc('deleteConfirmBody'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteAppointment(draft.id!);
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      onOpenChange(false);
      toast({ tone: 'success', title: t('deleted') });
      router.refresh();
    });
  }

  /* ---- the reminder trail ------------------------------------------------ */

  const startDate = new Date(start);
  const confirmLink =
    draft?.confirmationToken && origin
      ? `${origin}${confirmationPath(locale, draft.confirmationToken)}`
      : '';
  const reminderText = fillReminderTemplate(
    reminderTemplate?.trim() || t('reminder.defaultTemplate'),
    {
      name: patientChoice?.label ?? '',
      date: Number.isNaN(startDate.getTime()) ? '' : formatDate(startDate),
      time: Number.isNaN(startDate.getTime()) ? '' : formatTime(startDate),
      clinic: clinicName,
      link: confirmLink,
    },
  );
  const wa = draft?.patientPhone ? whatsappNumber(draft.patientPhone) : null;
  const whatsappHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(reminderText)}` : null;

  /**
   * Opening WhatsApp is the sending. The mark is made as the link opens —
   * there is no separate "yes, I sent it" to forget.
   */
  function sentViaWhatsApp() {
    if (!draft?.id || reminderSentAt) return;
    const stamp = new Date().toISOString();
    setReminderSentAt(stamp);
    startTransition(async () => {
      const result = await markReminderSent(draft.id!, true);
      if (!result.ok) {
        setReminderSentAt(null);
        return;
      }
      router.refresh();
    });
  }

  function answer(next: 'confirmed' | 'declined' | null) {
    if (!draft?.id) return;
    const previous = { response, respondedAt };
    setResponse(next);
    setRespondedAt(next ? new Date().toISOString() : null);
    if (next === 'confirmed' && status === 'scheduled') setStatus('confirmed');
    startTransition(async () => {
      const result = await setConfirmationResponse(draft.id!, next);
      if (!result.ok) {
        setResponse(previous.response);
        setRespondedAt(previous.respondedAt);
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      router.refresh();
    });
  }

  function renderError() {
    if (!errorKey) return null;
    if (errorKey === 'errors.appointmentOverlap') return t('overlapError');
    if (errorKey === 'errors.roomOverlap') return tErrors('roomOverlap');
    if (errorKey === 'errors.endMustBeAfterStart') return tErrors('endMustBeAfterStart');
    if (errorKey === 'common.somethingMissing') return tc('somethingMissing');
    return tc('errorGeneric');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? t('edit') : t('new')}
        closeLabel={tc('close')}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorKey ? <Alert tone="danger">{renderError()}</Alert> : null}

          {/* First, because on the day it is the only reason the dialog is
              opened. The booking's details are underneath for when they are. */}
          {isEditing && patientId ? (
            <div className="rounded-lg border border-jade-200 bg-jade-50 p-3">
              <StartEncounterButton
                patientId={patientId}
                appointmentId={draft?.id}
                size="md"
                onStarted={() => onOpenChange(false)}
              />
            </div>
          ) : null}

          {/* Typed, not scrolled. A practice of any age has hundreds of files
              and a dropdown of them cannot be searched — you know the name, and
              the list is the thing standing between you and it. Only real
              patients here: a booking has to point at a file that exists, so
              free text is deliberately not allowed. */}
          <Field label={t('patient')} htmlFor="patient_id" required>
            <Combobox
              id="patient_id"
              label={t('patient')}
              placeholder={t('searchPatient')}
              options={patientOptions}
              value={patientChoice}
              onChange={(choice) => setPatientChoice(choice)}
            />
          </Field>

          <FieldGrid>
            <Field label={t('type')} htmlFor="appointment_type_id">
              <Select
                id="appointment_type_id"
                value={typeId}
                onChange={(event) => handleTypeChange(event.target.value)}
              >
                <option value="">{t('selectType')}</option>
                {activeTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {appointmentTypeName(type, locale)} · {type.default_duration_minutes}′
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={tc('status')} htmlFor="status">
              <Select
                id="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as AppointmentStatus)}
              >
                {APPOINTMENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`status.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('startAt')} htmlFor="start_at" required>
              <LtrInput
                id="start_at"
                type="datetime-local"
                value={start}
                onChange={(event) => handleStartChange(event.target.value)}
                required
              />
            </Field>

            <Field label={t('endAt')} htmlFor="end_at" required>
              <LtrInput
                id="end_at"
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                required
              />
            </Field>

            {hasLocations ? (
              <Field label={t('place')} htmlFor="location_id" required>
                <Select
                  id="location_id"
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  required
                >
                  <option value="">{t('selectPlace')}</option>
                  {activeLocations.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {hasRooms ? (
              <Field label={t('room')} htmlFor="room_id" required>
                <Select
                  id="room_id"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  required
                >
                  <option value="">{t('selectRoom')}</option>
                  {activeRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </FieldGrid>

          {outsideHours ? (
            <Alert tone="warning">
              {outsideHours.reason
                ? `${t('outsideHours')} · ${outsideHours.reason}`
                : t('outsideHours')}
            </Alert>
          ) : null}

          {/* A course of treatment, booked in one go.
              Offered only on a new appointment: "repeat this ten times" is a
              different action from editing the one in front of you. */}
          {!isEditing ? (
            <div className="rounded-lg border border-ink-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
                <input
                  type="checkbox"
                  checked={repeats}
                  onChange={(event) => setRepeats(event.target.checked)}
                  className="h-4 w-4 rounded border-ink-300"
                />
                {t('repeatSeries')}
              </label>

              {repeats ? (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label={t('everyWeeks')} htmlFor="every_weeks" density="compact">
                      <LtrInput
                        id="every_weeks"
                        type="number"
                        min={1}
                        max={12}
                        className="w-24"
                        value={everyWeeks}
                        onChange={(event) => setEveryWeeks(event.target.value)}
                      />
                    </Field>
                    <Field label={t('occurrences')} htmlFor="occurrences" density="compact">
                      <LtrInput
                        id="occurrences"
                        type="number"
                        min={2}
                        max={52}
                        className="w-24"
                        value={occurrences}
                        onChange={(event) => setOccurrences(event.target.value)}
                      />
                    </Field>
                  </div>
                  <p className="text-xs text-ink-600">{t('repeatSeriesHint')}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* What the series actually managed to book. A clash is information,
              not an error: nine of ten were made, and this says which one was
              not and why. */}
          {seriesResult ? (
            <Alert tone="warning" title={t('seriesCreated', { count: seriesResult.created })}>
              <ul className="mt-1 space-y-0.5">
                {seriesResult.skipped.map((entry) => (
                  <li key={entry.start_at} className="flex flex-wrap items-baseline gap-1.5">
                    <span dir="ltr" className="tabular-nums">
                      {formatDate(new Date(entry.start_at))}{' '}
                      {format.dateTime(new Date(entry.start_at), 'time')}
                    </span>
                    <span>· {t(`seriesSkipped.${entry.reason}`)}</span>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <Field label={tc('notes')} htmlFor="notes">
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>

          {/* The reminder, and the answer to it.

              Sending is through WhatsApp with the message already written,
              and opening it is the sending — the mark is made as the link
              opens. The answer comes back through the link on its own, and
              can be set here for a patient who rang instead: the button that
              is true turns its colour and says when. */}
          {/* Folded by default: the booking's fields are what the dialog is
              opened for, and the reminder trail is read once a day at most.
              The badge on the fold says where things stand without opening it. */}
          {isEditing && draft?.confirmationToken ? (
            <Collapsible
              title={t('reminder.title')}
              badge={
                <ConfirmationBadge
                  appointment={{
                    status,
                    reminder_sent_at: reminderSentAt,
                    confirmation_response: response,
                  }}
                />
              }
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {whatsappHref ? (
                  <Button asChild size="sm" variant={reminderSentAt ? 'secondary' : 'primary'}>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={sentViaWhatsApp}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      {t('reminder.sendWhatsApp')}
                    </a>
                  </Button>
                ) : (
                  <p className="text-xs text-ink-500">{t('reminder.noPhone')}</p>
                )}
                {reminderSentAt ? (
                  <span className="text-xs text-ink-600">
                    {t('reminder.sentAt')}{' '}
                    <span dir="ltr" className="tabular-nums">
                      {formatDateTime(new Date(reminderSentAt))}
                    </span>
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-pressed={response === 'confirmed'}
                  disabled={isPending}
                  className={cn(
                    response === 'confirmed' &&
                      'border-jade-600 bg-jade-600 text-accent-fg hover:bg-jade-700',
                  )}
                  onClick={() => answer(response === 'confirmed' ? null : 'confirmed')}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  {t('reminder.setConfirmed')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-pressed={response === 'declined'}
                  disabled={isPending}
                  className={cn(
                    response === 'declined' &&
                      'border-red-600 bg-red-600 text-accent-fg hover:bg-red-700',
                  )}
                  onClick={() => answer(response === 'declined' ? null : 'declined')}
                >
                  <X className="h-4 w-4" aria-hidden />
                  {t('reminder.setDeclined')}
                </Button>
              </div>

              {response && respondedAt ? (
                <p
                  className={cn(
                    'text-xs',
                    response === 'confirmed' ? 'text-jade-800' : 'text-red-700',
                  )}
                >
                  {t(response === 'confirmed' ? 'reminder.confirmedAt' : 'reminder.declinedAt')}{' '}
                  <span dir="ltr" className="tabular-nums">
                    {formatDateTime(new Date(respondedAt))}
                  </span>
                </p>
              ) : null}
            </Collapsible>
          ) : null}

          <DialogFooter>
            {/* Delete after Save, with a gap, rather than at the start edge
                where a Hebrew reader's eye lands first. */}
            {isEditing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isPending}
                className="order-last ms-3 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                {tc('delete')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {isPending
                ? tc('saving')
                : !isEditing && repeats
                  ? t('bookSeries', { count: Number(occurrences) || 0 })
                  : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { AppointmentWithRelations };
