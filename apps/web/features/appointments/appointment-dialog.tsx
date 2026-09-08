'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  FieldGrid,
  Input,
  LtrInput,
  Combobox,
  Select,
  type ComboboxOption,
  type ComboboxValue,
  Spinner,
  Textarea,
} from '@clinic/ui';
import { APPOINTMENT_STATUSES, type AppointmentStatus, type Locale } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type { AppointmentType, AppointmentWithRelations, Patient } from '@clinic/db/types';
import { appointmentTypeName } from '@/lib/display';
import { StartEncounterButton } from '@/features/encounters/start-encounter-button';
import {
  createAppointment,
  createAppointmentSeries,
  deleteAppointment,
  updateAppointment,
  type SeriesResult,
} from './actions';
import { closureFor, isWithinWorkingHours, type Availability } from './availability';
import { addMinutes, differenceInMinutes, toDateTimeLocalValue } from './date-utils';
import { formatDate } from '@clinic/i18n';

export interface AppointmentDraft {
  id?: string;
  patientId?: string;
  start: Date;
  end: Date;
  typeId?: string | null;
  status?: AppointmentStatus;
  location?: string | null;
  notes?: string | null;
}

/**
 * Create/edit dialog for a booking.
 *
 * Times are handled as `datetime-local` values (local wall-clock) and converted to
 * ISO instants only on submit. Binding a UTC string straight to the input would
 * show the practitioner a time that is not the one they booked.
 */
export function AppointmentDialog({
  open,
  draft,
  patients,
  appointmentTypes,
  practitionerId,
  availability,
  onOpenChange,
}: {
  open: boolean;
  draft: AppointmentDraft | null;
  patients: Pick<Patient, 'id' | 'full_name' | 'phone'>[];
  appointmentTypes: AppointmentType[];
  practitionerId: string;
  /** Working hours, for the out-of-hours notice. Nothing here blocks a save. */
  availability: Availability;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const router = useRouter();
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
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // A course of treatment. Only offered on a new booking: turning an existing
  // appointment into a series would have to decide what the original row means,
  // and "book ten more like this one" is a different action from "edit this".
  const [repeats, setRepeats] = useState(false);
  const [everyWeeks, setEveryWeeks] = useState('1');
  const [occurrences, setOccurrences] = useState('4');
  const [seriesResult, setSeriesResult] = useState<SeriesResult | null>(null);

  const isEditing = Boolean(draft?.id);

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
    setLocation(draft.location ?? '');
    setNotes(draft.notes ?? '');
    setErrorKey(null);
    setRepeats(false);
    setSeriesResult(null);
  }, [draft]);

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

    const payload = {
      patient_id: patientId,
      practitioner_id: practitionerId,
      appointment_type_id: typeId || null,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      status,
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
      router.refresh();
    });
  }

  function handleDelete() {
    if (!draft?.id) return;
    if (!window.confirm(tc('deleteConfirmBody'))) return;
    startTransition(async () => {
      const result = await deleteAppointment(draft.id!);
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  function renderError() {
    if (!errorKey) return null;
    if (errorKey === 'errors.appointmentOverlap') return t('overlapError');
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

            <Field label={t('location')} htmlFor="location">
              <Input
                id="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>
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

          {isEditing && patientId ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
              <StartEncounterButton
                patientId={patientId}
                appointmentId={draft?.id}
                variant="secondary"
                size="sm"
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
