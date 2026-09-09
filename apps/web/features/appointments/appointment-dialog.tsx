'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Check, Copy, Link2, MessageCircle, Trash2, X } from 'lucide-react';
import {
  Alert,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  FieldGrid,
  Input,
  LtrInput,
  Select,
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
import type { AppointmentType, AppointmentWithRelations, Patient, Room } from '@clinic/db/types';
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
import { closureFor, isWithinWorkingHours, type Availability } from './availability';
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
 * With rooms defined, the room replaces the free-text location: it is what
 * decides whether two bookings at one hour are a clash or two beds.
 */
export function AppointmentDialog({
  open,
  draft,
  patients,
  appointmentTypes,
  rooms,
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
  const [roomId, setRoomId] = useState('');
  const [location, setLocation] = useState('');
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

  const isEditing = Boolean(draft?.id);
  const activeRooms = useMemo(
    () => rooms.filter((room) => room.is_active || room.id === roomId),
    [rooms, roomId],
  );
  const hasRooms = rooms.some((room) => room.is_active);

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
    setTypeId(draft.typeId ?? '');
    setStart(toDateTimeLocalValue(draft.start));
    setEnd(toDateTimeLocalValue(draft.end));
    setStatus(draft.status ?? 'scheduled');
    // A new booking in a clinic with rooms goes into the first one: with
    // rooms, every booking has one, or the clash rule has nothing to hold.
    setRoomId(draft.roomId ?? (draft.id ? '' : (rooms.find((room) => room.is_active)?.id ?? '')));
    setLocation(draft.location ?? '');
    setNotes(draft.notes ?? '');
    setReminderSentAt(draft.reminderSentAt ?? null);
    setResponse(draft.confirmationResponse ?? null);
    setRespondedAt(draft.respondedAt ?? null);
    setErrorKey(null);
    setRepeats(false);
    setSeriesResult(null);
  }, [draft, patients, rooms]);

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
    return { reason: closureFor(startDate, availability)?.reason ?? null };
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

    if (!patientId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setErrorKey('common.somethingMissing');
      return;
    }
    if (endDate <= startDate) {
      setErrorKey('errors.endMustBeAfterStart');
      return;
    }
    if (hasRooms && !roomId) {
      setErrorKey('common.somethingMissing');
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
      location,
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
    draft?.confirmationToken && typeof window !== 'undefined'
      ? `${window.location.origin}${confirmationPath(locale, draft.confirmationToken)}`
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

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: t('reminder.copied') });
    } catch {
      toast({ tone: 'danger', title: t('reminder.copyFailed') });
    }
  }

  function sent(next: boolean) {
    if (!draft?.id) return;
    const previous = reminderSentAt;
    setReminderSentAt(next ? new Date().toISOString() : null);
    startTransition(async () => {
      const result = await markReminderSent(draft.id!, next);
      if (!result.ok) {
        setReminderSentAt(previous);
        toast({ tone: 'danger', title: tc('errorGeneric') });
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
            ) : (
              <Field label={t('location')} htmlFor="location">
                <Input
                  id="location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </Field>
            )}
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

              Sending is by hand, through WhatsApp with the message already
              written, because no sending service is connected yet; the mark
              "sent" is what turns the calendar's dot amber. The answer comes
              back through the link on its own, and can be set here as well
              for a patient who rang instead. */}
          {isEditing && draft?.confirmationToken ? (
            <section
              aria-labelledby="reminder-heading"
              className="space-y-3 rounded-lg border border-ink-200 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="reminder-heading" className="text-sm font-semibold text-ink-900">
                  {t('reminder.title')}
                </h3>
                <ConfirmationBadge
                  appointment={{
                    status,
                    reminder_sent_at: reminderSentAt,
                    confirmation_response: response,
                  }}
                />
              </div>

              <p className="text-xs text-ink-600">{t('reminder.intro')}</p>

              <div className="flex flex-wrap items-center gap-1.5">
                {whatsappHref ? (
                  <Button asChild size="sm" variant="secondary">
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      {t('reminder.sendWhatsApp')}
                    </a>
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="ghost" onClick={() => copyText(reminderText)}>
                  <Copy className="h-4 w-4" aria-hidden />
                  {t('reminder.copyMessage')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!confirmLink}
                  onClick={() => copyText(confirmLink)}
                >
                  <Link2 className="h-4 w-4" aria-hidden />
                  {t('reminder.copyLink')}
                </Button>
              </div>
              {!whatsappHref ? <p className="text-xs text-ink-500">{t('reminder.noPhone')}</p> : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-600">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={reminderSentAt !== null}
                    disabled={isPending}
                    onChange={(event) => sent(event.target.checked)}
                    className="h-4 w-4 rounded border-ink-300"
                  />
                  {t('reminder.markSent')}
                </label>
                {reminderSentAt ? (
                  <span>
                    {t('reminder.sentAt')}{' '}
                    <span dir="ltr" className="tabular-nums">
                      {formatDateTime(new Date(reminderSentAt))}
                    </span>
                  </span>
                ) : null}
                {respondedAt ? (
                  <span>
                    {t('reminder.answeredAt')}{' '}
                    <span dir="ltr" className="tabular-nums">
                      {formatDateTime(new Date(respondedAt))}
                    </span>
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={response === 'confirmed' ? 'primary' : 'secondary'}
                  aria-pressed={response === 'confirmed'}
                  disabled={isPending}
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
                  className={cn(response === 'declined' && 'border-red-600 bg-red-50 text-red-700')}
                  onClick={() => answer(response === 'declined' ? null : 'declined')}
                >
                  <X className="h-4 w-4" aria-hidden />
                  {t('reminder.setDeclined')}
                </Button>
              </div>
            </section>
          ) : null}

          {isEditing && patientId ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
              <StartEncounterButton
                patientId={patientId}
                appointmentId={draft?.id}
                variant="secondary"
                size="sm"
                onStarted={() => onOpenChange(false)}
              />
            </div>
          ) : null}

          <DialogFooter>
            {isEditing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isPending}
                className="me-auto text-red-600 hover:bg-red-50"
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
