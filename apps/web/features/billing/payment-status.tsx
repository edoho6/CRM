'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Check,
  ChevronDown,
  CreditCard,
  ExternalLink,
  FileText,
  Receipt,
  Undo2,
} from 'lucide-react';
import { VISIT_PAYMENT_METHODS } from '@clinic/domain';
import { Badge, Button, Popover, Select, Spinner, useToast } from '@clinic/ui';
import { Link, useRouter } from '@clinic/i18n/navigation';
import { createInvoiceFromEncounter } from './actions';
import { markAppointmentPaid, unmarkAppointmentPaid } from './manual-payment-actions';

/**
 * Whether a visit has been paid for, and the way to take the payment.
 *
 * One component in three places — the appointment list inside a patient's file,
 * the treatment list, and the treatment itself — because it is one question and
 * three different answers to it would eventually disagree.
 *
 * The states are deliberately four rather than two. "Not billed yet" and "billed
 * and unpaid" are different situations calling for different actions, and a part
 * payment is neither paid nor unpaid. Collapsing any of them into a green tick
 * is the kind of error that surfaces at the year end.
 */

export type PaymentState = 'unbilled' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';

export interface PaymentSummary {
  state: PaymentState;
  invoiceId: string | null;
  invoiceNumber: number | null;
  total: number | null;
  amountPaid: number | null;
  paymentUrl: string | null;
  /** Marked paid by hand on the booking, without an invoice; wins over the invoice. */
  manualPaidAt: string | null;
  manualMethod: string | null;
}

const TONES: Record<PaymentState, 'success' | 'warning' | 'danger' | 'neutral' | 'muted'> = {
  paid: 'success',
  partially_paid: 'warning',
  unpaid: 'danger',
  unbilled: 'muted',
  cancelled: 'neutral',
};

/** The badge alone, for a table cell where there is no room for a button. */
export function PaymentBadge({ summary }: { summary: PaymentSummary }) {
  const t = useTranslations('billing.payment');
  const format = useFormatter();

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={TONES[summary.state]}>
        {t(`state.${summary.state}`)}
        {/* How, when it was marked by hand: "paid · cash" answers the next question. */}
        {summary.manualPaidAt && summary.manualMethod
          ? ` · ${t(`methods.${summary.manualMethod}`)}`
          : null}
      </Badge>
      {summary.state === 'partially_paid' &&
      summary.amountPaid !== null &&
      summary.total !== null ? (
        // A part payment without its numbers is not a useful thing to be told.
        <span dir="ltr" className="text-xs tabular-nums text-ink-600">
          {format.number(Number(summary.amountPaid), 'currency')} /{' '}
          {format.number(Number(summary.total), 'currency')}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The badge plus whatever action the state calls for.
 *
 * Unbilled raises the invoice; unpaid opens the provider's payment page in a new
 * tab, because the patient pays on the provider's domain and never on ours;
 * paid links to the invoice.
 */
export function PaymentAction({
  summary,
  encounterId,
  appointmentId,
  canBill,
}: {
  summary: PaymentSummary;
  /**
   * The booking, when there is one and this person may mark money: offers
   * "mark as paid" without an invoice (cash, Bit…), and taking the mark back.
   */
  appointmentId?: string | null;
  /** Present when there is a treatment to bill for. */
  encounterId?: string | null;
  /** False when no provider is configured — the button would only ever fail. */
  canBill: boolean;
}) {
  const t = useTranslations('billing.payment');
  const tc = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [method, setMethod] = useState('');

  function mark(close: () => void) {
    if (!appointmentId) return;
    startTransition(async () => {
      const result = await markAppointmentPaid(appointmentId, method || null);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      close();
      router.refresh();
    });
  }

  function unmark(close: () => void) {
    if (!appointmentId) return;
    startTransition(async () => {
      const result = await unmarkAppointmentPaid(appointmentId);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      close();
      router.refresh();
    });
  }

  function bill() {
    if (!encounterId) return;
    startTransition(async () => {
      const result = await createInvoiceFromEncounter(encounterId);
      if (result.ok) router.refresh();
    });
  }

  /*
   * The badge is the control.
   *
   * A row of buttons beside every line is a lot of furniture for something that
   * is usually just being read — the answer to "was this paid?" is wanted far
   * more often than the actions are. So the status itself opens them, which also
   * means one target instead of three and the same target in all three screens.
   */
  return (
    <Popover
      width={248}
      align="end"
      panelLabel={t('actionsFor', { state: t(`state.${summary.state}`) })}
      triggerLabel={t('actionsFor', { state: t(`state.${summary.state}`) })}
      triggerClassName="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-ink-100"
      triggerContent={
        <>
          <PaymentBadge summary={summary} />
          <ChevronDown className="h-3 w-3 shrink-0 text-ink-500" aria-hidden />
        </>
      }
    >
      {({ close }) => (
        <div className="flex flex-col gap-2">
          {summary.total !== null ? (
            <p className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink-600">{tc('total')}</span>
              <span dir="ltr" className="font-medium tabular-nums text-ink-900">
                {format.number(Number(summary.total), 'currency')}
              </span>
            </p>
          ) : null}

          {/* Paid by hand: the way back, and nothing else — the badge
              already says paid and how. */}
          {summary.manualPaidAt ? (
            appointmentId ? (
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                disabled={isPending}
                onClick={() => unmark(close)}
              >
                {isPending ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <Undo2 className="h-3.5 w-3.5" />
                )}
                {t('unmarkPaid')}
              </Button>
            ) : null
          ) : summary.state !== 'paid' && appointmentId ? (
            // Paid without an invoice: cash on the desk, a transfer, Bit. The
            // method is optional — "paid" is the fact, how is a detail.
            <div className="space-y-2 border-b border-ink-100 pb-2">
              <label className="block space-y-1 text-xs text-ink-700">
                <span>{t('method')}</span>
                <Select value={method} onChange={(event) => setMethod(event.target.value)}>
                  <option value="">{t('methodNone')}</option>
                  {VISIT_PAYMENT_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {t(`methods.${option}`)}
                    </option>
                  ))}
                </Select>
              </label>
              <Button size="sm" className="w-full" disabled={isPending} onClick={() => mark(close)}>
                {isPending ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {t('markPaid')}
              </Button>
            </div>
          ) : null}

          {summary.state === 'unbilled' && !summary.manualPaidAt ? (
            encounterId && canBill ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  bill();
                  close();
                }}
                disabled={isPending}
              >
                {isPending ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <Receipt className="h-3.5 w-3.5" />
                )}
                {t('bill')}
              </Button>
            ) : (
              // Saying why is more use than a disabled button with no reason.
              <p className="text-xs text-ink-600">
                {canBill ? t('noEncounterToBill') : t('noProvider')}
              </p>
            )
          ) : null}

          {(summary.state === 'unpaid' || summary.state === 'partially_paid') &&
          summary.paymentUrl ? (
            <Button size="sm" asChild>
              {/* The patient pays on the provider's own domain. This link leaves
                  the application on purpose — a card number must never be typed
                  into a page this system serves. */}
              <a
                href={summary.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
              >
                <CreditCard className="h-3.5 w-3.5" />
                {t('pay')}
                <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
              </a>
            </Button>
          ) : null}

          {summary.invoiceId ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/billing/${summary.invoiceId}`} onClick={close}>
                <FileText className="h-4 w-4" />
                {summary.invoiceNumber
                  ? t('openInvoiceNumbered', { number: summary.invoiceNumber })
                  : t('viewInvoice')}
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </Popover>
  );
}
