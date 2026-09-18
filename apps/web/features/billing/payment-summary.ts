import type { PaymentSummary, PaymentState } from './payment-status';

/**
 * Turns a row of `encounter_payment_status` or `appointment_payment_status`
 * into what the badge needs.
 *
 * A plain module, not part of the `'use client'` component: server pages call it
 * to shape their data, and a function exported from a client module arrives on
 * the server as a client reference and fails at runtime rather than in the build.
 *
 * A missing row means the visit has never been billed, which is a real state
 * rather than an error — most treatments are in it for the first few minutes of
 * their life.
 */
export interface PaymentStatusRow {
  invoice_id: string | null;
  invoice_number: number | null;
  total: number | null;
  amount_paid: number | null;
  payment_url: string | null;
  payment_state: string;
  /** The booking's hand mark (migration 20260919100000); absent before it. */
  paid_at?: string | null;
  paid_method?: string | null;
}

const STATES: readonly PaymentState[] = [
  'unbilled',
  'unpaid',
  'partially_paid',
  'paid',
  'cancelled',
];

export function toPaymentSummary(row: PaymentStatusRow | undefined | null): PaymentSummary {
  if (!row) {
    return {
      state: 'unbilled',
      invoiceId: null,
      invoiceNumber: null,
      total: null,
      amountPaid: null,
      paymentUrl: null,
      manualPaidAt: null,
      manualMethod: null,
    };
  }

  const state = STATES.includes(row.payment_state as PaymentState)
    ? (row.payment_state as PaymentState)
    : 'unbilled';

  return {
    state,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    total: row.total === null ? null : Number(row.total),
    amountPaid: row.amount_paid === null ? null : Number(row.amount_paid),
    paymentUrl: row.payment_url,
    manualPaidAt: row.paid_at ?? null,
    manualMethod: row.paid_method ?? null,
  };
}
