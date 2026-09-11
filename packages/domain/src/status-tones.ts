import type { AppointmentStatus, ShopStoreStatus, TreatmentStatus } from './enums';

/**
 * One colour per meaning, for the whole product.
 *
 * A status used to be coloured wherever it was shown, and three screens
 * disagreed about what green meant. This is the single place that decides,
 * and every badge imports from here. Both apps read it, which is why it lives
 * in the domain package rather than beside a component.
 *
 * The tones are the badge's, not raw colours: `success` is jade on this
 * theme and something else on the next, and that is the badge's business.
 *
 * Two rules the maps keep to. Opposite outcomes never share a tone — a
 * course that succeeded and one that did not are never both green. And
 * "finished, nothing to do" is muted, not green: green is for a good result,
 * grey for a closed one.
 */
export type StatusTone = 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'info';

export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, StatusTone> = {
  scheduled: 'neutral',
  confirmed: 'success',
  checked_in: 'info',
  completed: 'muted',
  cancelled: 'danger',
  no_show: 'warning',
};

/** A shop in the price comparison: read, stopped by an admin, waiting for the shop's word, or unreadable. */
export const SHOP_STORE_STATUS_TONES: Record<ShopStoreStatus, StatusTone> = {
  active: 'success',
  paused: 'warning',
  awaiting_permission: 'neutral',
  unsupported: 'muted',
};

export const TREATMENT_STATUS_TONES: Record<TreatmentStatus, StatusTone> = {
  active: 'info',
  inactive: 'muted',
  completed: 'muted',
  dropped_out: 'warning',
  full_success: 'success',
  partial_success: 'neutral',
  unsuccessful: 'danger',
};

export const INVOICE_STATUS_TONES: Record<string, StatusTone> = {
  draft: 'neutral',
  sent: 'info',
  paid: 'success',
  partially_paid: 'warning',
  unpaid: 'danger',
  overdue: 'danger',
  cancelled: 'muted',
};

export const ENCOUNTER_STATUS_TONES: Record<string, StatusTone> = {
  draft: 'warning',
  signed: 'success',
};

export const PAYMENT_STATUS_TONES: Record<string, StatusTone> = {
  pending: 'neutral',
  paid: 'success',
  failed: 'danger',
  // Money returned is a closed matter, not a failure.
  refunded: 'muted',
};

/** A consent: given, withdrawn, or never asked. */
export const CONSENT_TONES = {
  granted: 'success',
  withdrawn: 'danger',
  missing: 'muted',
} as const satisfies Record<string, StatusTone>;

/** Looks a status up, falling back to neutral for a value the map has not met. */
export function statusTone(map: Record<string, StatusTone>, status: string | null | undefined): StatusTone {
  return (status && map[status]) || 'neutral';
}
