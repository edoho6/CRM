'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  Select,
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
  deleteAppointment,
  updateAppointment,
} from './actions';
import { addMinutes, differenceInMinutes, toDateTimeLocalValue } from './date-utils';

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
  onOpenChange,
}: {
  open: boolean;
  draft: AppointmentDraft | null;
  patients: Pick<Patient, 'id' | 'full_name'>[];
  appointmentTypes: AppointmentType[];
  practitionerId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [patientId, setPatientId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('scheduled');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const isEditing = Boolean(draft?.id);

  useEffect(() => {
    if (!draft) return;
    setPatientId(draft.patientId ?? '');
    setTypeId(draft.typeId ?? '');
    setStart(toDateTimeLocalValue(draft.start));
    setEnd(toDateTimeLocalValue(draft.end));
    setStatus(draft.status ?? 'scheduled');
    setLocation(draft.location ?? '');
    setNotes(draft.notes ?? '');
    setErrorKey(null);
  }, [draft]);

  const activeTypes = useMemo(
    () => appointmentTypes.filter((type) => type.is_active || type.id === typeId),
    [appointmentTypes, typeId],
  );

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

          <Field label={t('patient')} htmlFor="patient_id" required>
            <Select
              id="patient_id"
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              required
            >
              <option value="">{t('selectPatient')}</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.full_name}
                </option>
              ))}
            </Select>
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
              {isPending ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { AppointmentWithRelations };
