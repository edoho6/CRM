'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { CalendarClock, FileText, Pencil, Phone, Stethoscope } from 'lucide-react';
import { Badge, Button, Dialog, DialogContent, DialogFooter } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { APPOINTMENT_STATUS_TONES, statusTone, type Locale } from '@clinic/domain';
import type { AppointmentWithRelations } from '@clinic/db/types';
import { appointmentTypeName, patientFullName } from '@/lib/display';
import { StartEncounterButton } from '@/features/encounters/start-encounter-button';
import { PhoneActions } from '@/components/phone-actions';
import { ConfirmationBadge } from './confirmation-status';
import { PaymentAction, type PaymentSummary } from '@/features/billing/payment-status';
import { formatDateTime } from '@clinic/i18n';

/**
 * One booking, read before it is touched.
 *
 * A click on the diary used to open the edit form straight away — twelve
 * fields, for a question that is usually "who is this and did they confirm".
 * This is the answer: when, who, in which room, what kind of visit, whether
 * they said they are coming, their number, the notes. Editing is a button
 * inside it, so the form is reached on purpose.
 *
 * A dialog rather than a hover card: a hover has no meaning on a phone and
 * none for a keyboard, and on a phone this becomes the bottom sheet every
 * other dialog becomes.
 */
export function AppointmentDetails({
  appointment,
  locale,
  onClose,
  onEdit,
  payment,
  canBill,
}: {
  appointment: AppointmentWithRelations | null;
  /**
   * Whether the visit is paid, and the way to mark it paid (cash, Bit…) from
   * here — the desk's question as the patient leaves. Null for a role that
   * does not see money: the row is not drawn at all.
   */
  payment: PaymentSummary | null;
  canBill: boolean;
  locale: Locale;
  onClose: () => void;
  onEdit: (appointment: AppointmentWithRelations) => void;
}) {
  const t = useTranslations('appointments');
  const td = useTranslations('appointments.details');
  const tc = useTranslations('common');
  const format = useFormatter();

  const open = appointment !== null;
  const start = appointment ? new Date(appointment.start_at) : null;
  const end = appointment ? new Date(appointment.end_at) : null;
  const isCancelled = appointment?.status === 'cancelled';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {appointment && start && end ? (
        <DialogContent
          title={patientFullName(appointment.patient)}
          description={td('title')}
          closeLabel={tc('close')}
          className="max-w-md"
        >
          <dl className="divide-y divide-ink-100 text-sm">
            {/* The day and the hours first: the diary was opened for them.
                A flex row with a gap rather than margins on inline spans — the
                date ends in a numeral and the hours begin with one, and two
                numerals either side of a margin in a Hebrew line ran together
                into one long number. The length of the visit was a third
                figure on the same line answering a question nobody had asked;
                it is in the booking form, where it is set. */}
            <Row icon={<CalendarClock className="h-4 w-4" aria-hidden />} label={td('when')}>
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-medium text-ink-900">
                  {format.dateTime(start, 'weekday')}
                </span>
                {/* Isolated, so the dash between the hours stays between them in a
                    Hebrew sentence. */}
                <bdi className="tabular-nums" dir="ltr">
                  {format.dateTime(start, 'time')}–{format.dateTime(end, 'time')}
                </bdi>
              </span>
            </Row>

            <Row label={t('type')}>
              <span className="inline-flex items-center gap-2">
                {appointment.appointment_type?.color ? (
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: appointment.appointment_type.color }}
                  />
                ) : null}
                {appointmentTypeName(appointment.appointment_type, locale)}
              </span>
            </Row>

            {appointment.room || appointment.place || appointment.location ? (
              <Row label={t('room')}>
                <span className="inline-flex flex-wrap items-center gap-2">
                  {appointment.room ? (
                    <span
                      className="rounded px-1.5 text-xs font-medium leading-5"
                      style={{ backgroundColor: `${appointment.room.color}33` }}
                    >
                      {appointment.room.name}
                    </span>
                  ) : null}
                  {appointment.place ? (
                    <span className="text-ink-700">{appointment.place.name}</span>
                  ) : appointment.location ? (
                    <span className="text-ink-700">{appointment.location}</span>
                  ) : null}
                </span>
              </Row>
            ) : null}

            <Row label={td('status')}>
              <span className="inline-flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(APPOINTMENT_STATUS_TONES, appointment.status)}>
                  {t(`status.${appointment.status}`)}
                </Badge>
                {!isCancelled ? <ConfirmationBadge appointment={appointment} /> : null}
              </span>
            </Row>

            {payment && !isCancelled ? (
              <Row label={td('payment')}>
                <PaymentAction summary={payment} appointmentId={appointment.id} canBill={canBill} />
              </Row>
            ) : null}

            {/* The number, with the two things anyone does with it. Ringing was
                the only offer, and on a desk `tel:` usually does nothing at
                all — while the message that actually gets sent between a
                treatment and the next one is a WhatsApp. Same control as the
                patient's file, so it behaves the same in both places. */}
            {appointment.patient?.phone ? (
              <Row icon={<Phone className="h-4 w-4" aria-hidden />} label={td('phone')}>
                <PhoneActions phone={appointment.patient.phone} />
              </Row>
            ) : null}

            {appointment.notes ? (
              <Row label={td('notes')}>
                <span className="whitespace-pre-wrap text-ink-800" dir="auto">
                  {appointment.notes}
                </span>
              </Row>
            ) : null}

            {appointment.reminder_sent_at ? (
              <Row label={td('reminder')}>
                {td('reminderSentAt', {
                  date: formatDateTime(new Date(appointment.reminder_sent_at)),
                })}
              </Row>
            ) : null}
          </dl>

          <DialogFooter className="flex-wrap">
            <Button type="button" variant="secondary" onClick={() => onEdit(appointment)}>
              <Pencil className="h-4 w-4" aria-hidden />
              {td('edit')}
            </Button>
            {appointment.patient ? (
              <Button asChild variant="secondary">
                <Link href={`/patients/${appointment.patient.id}`}>
                  <FileText className="h-4 w-4" aria-hidden />
                  {td('file')}
                </Link>
              </Button>
            ) : null}
            {/* The treatment: the one already opened for this visit, or a new one. */}
            {appointment.encounter_id ? (
              <Button asChild>
                <Link href={`/encounters/${appointment.encounter_id}`}>
                  <Stethoscope className="h-4 w-4" aria-hidden />
                  {td('treatment')}
                </Link>
              </Button>
            ) : appointment.patient && !isCancelled ? (
              <StartEncounterButton
                patientId={appointment.patient.id}
                appointmentId={appointment.id}
                label={td('start')}
                onStarted={onClose}
              />
            ) : null}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <dt className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-ink-500">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-ink-900">{children}</dd>
    </div>
  );
}
