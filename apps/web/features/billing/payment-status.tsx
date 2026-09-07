'use client';

import { useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CreditCard, ExternalLink, Receipt } from 'lucide-react';
import { Badge, Button, Spinner } from '@clinic/ui';
import { Link, useRouter } from '@clinic/i18n/navigation';
import { createInvoiceFromEncounter } from './actions';

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
      <Badge tone={TONES[summary.state]}>{t(`state.${summary.state}`)}</Badge>
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
  canBill,
  size = 'sm',
}: {
  summary: PaymentSummary;
  /** Present when there is a treatment to bill for. */
  encounterId?: string | null;
  /** False when no provider is configured — the button would only ever fail. */
  canBill: boolean;
  size?: 'sm' | 'md';
}) {
  const t = useTranslations('billing.payment');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function bill() {
    if (!encounterId) return;
    startTransition(async () => {
      const result = await createInvoiceFromEncounter(encounterId);
      if (result.ok) router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <PaymentBadge summary={summary} />

      {summary.state === 'unbilled' && encounterId && canBill ? (
        <Button size={size} variant="secondary" onClick={bill} disabled={isPending}>
          {isPending ? <Spinner className="h-3.5 w-3.5" /> : <Receipt className="h-3.5 w-3.5" />}
          {t('bill')}
        </Button>
      ) : null}

      {(summary.state === 'unpaid' || summary.state === 'partially_paid') && summary.paymentUrl ? (
        <Button size={size} asChild>
          {/* The patient pays on the provider's own domain. This link leaves the
              application on purpose — a card number must never be typed into a
              page this system serves. */}
          <a href={summary.paymentUrl} target="_blank" rel="noopener noreferrer">
            <CreditCard className="h-3.5 w-3.5" />
            {t('pay')}
            <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
          </a>
        </Button>
      ) : null}

      {summary.invoiceId && summary.state !== 'unbilled' ? (
        <Link
          href={`/billing/${summary.invoiceId}`}
          className="text-xs text-jade-800 underline-offset-2 hover:underline"
        >
          {summary.invoiceNumber ? `#${summary.invoiceNumber}` : t('viewInvoice')}
        </Link>
      ) : null}
    </span>
  );
}
