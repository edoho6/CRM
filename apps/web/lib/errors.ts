import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Translates database errors into message keys the UI can render in the user's
 * language.
 *
 * The database raises bare codes (`insufficient_stock`) with a JSON `detail`
 * rather than prose, precisely so a Hebrew-speaking practitioner never sees an
 * English Postgres string.
 */

export interface AppError {
  /** Key under the `errors` namespace, or `errors.serverError` as a catch-all. */
  key: string;
  /** Values for ICU interpolation, e.g. the herb that ran out. */
  values?: Record<string, string | number>;
}

/** Action codes that reach the screen by name: `errors.<code>`. */
export const PASS_THROUGH_CODES = [
  'assistant_not_configured',
  'assistant_unavailable',
  'assistant_gave_up',
  'assistant_quota',
  'assistant_name_in_question',
  'question_too_long',
  'amount_exceeds_outstanding',
  'patient_phone_required',
  'grow_not_configured',
  'practitioner_details_missing',
  'treatment_dates_unverified',
  'package_exhausted',
  'already_redeemed',
] as const;

interface InsufficientStockDetail {
  herb?: string;
  herb_id?: string;
  required?: number;
  available?: number;
}

function parseDetail(details: string | null | undefined): InsufficientStockDetail | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as InsufficientStockDetail;
  } catch {
    return null;
  }
}

export function mapDatabaseError(error: PostgrestError | Error | null | undefined): AppError {
  if (!error) return { key: 'errors.serverError' };

  const message = 'message' in error ? (error.message ?? '') : '';
  const details = 'details' in error ? ((error as PostgrestError).details ?? null) : null;
  const code = 'code' in error ? ((error as PostgrestError).code ?? '') : '';

  // The booking page's handle is a URL shared by the whole service.
  if (message.includes('slug_taken')) {
    return { key: 'errors.slugTaken' };
  }

  // 23P01 is an exclusion-constraint violation. Two of them guard the diary:
  // the room being taken is a different message from the practitioner being.
  if (message.includes('appointments_room_no_overlap')) {
    return { key: 'errors.roomOverlap' };
  }
  if (code === '23P01' || message.includes('appointments_no_overlap')) {
    return { key: 'errors.appointmentOverlap' };
  }

  if (message.includes('insufficient_stock')) {
    const detail = parseDetail(details);
    if (detail?.herb) {
      return {
        key: 'inventory.dispensing.insufficientStock',
        values: {
          herb: detail.herb,
          required: detail.required ?? 0,
          available: detail.available ?? 0,
        },
      };
    }
    return { key: 'errors.insufficientStock' };
  }

  if (message.includes('encounter_locked')) {
    return { key: 'errors.encounterLocked' };
  }

  if (message.includes('quantity_cannot_be_zero')) {
    return { key: 'errors.quantityCannotBeZero' };
  }

  if (message.includes('nothing_to_dispense')) {
    return { key: 'errors.formulaOrItemsRequired' };
  }

  if (message.includes('herbs_needs_a_name')) {
    return { key: 'inventory.herbs.nameRequired' };
  }

  if (message.includes('stock_ledger_is_append_only')) {
    return { key: 'errors.serverError' };
  }

  // The price comparison's admin functions raise these; 42501 is also what
  // a policy answers when a member writes where they may only read.
  if (message.includes('too_soon')) {
    return { key: 'errors.tooSoon' };
  }

  // The team screen: the database keeps every clinic with an owner, and
  // keeps an owner from switching themselves off.
  if (message.includes('reason_required')) {
    return { key: 'errors.reasonRequired' };
  }
  if (message.includes('encounter_not_signed')) {
    return { key: 'errors.encounterNotSigned' };
  }
  if (message.includes('last_owner')) {
    return { key: 'errors.lastOwner' };
  }
  if (message.includes('not_yourself')) {
    return { key: 'errors.notYourself' };
  }
  if (message.includes('already_member')) {
    return { key: 'errors.alreadyMember' };
  }
  if (message.includes('store_not_active')) {
    return { key: 'errors.storeNotActive' };
  }
  if (code === '42501' || message.includes('forbidden')) {
    return { key: 'errors.forbidden' };
  }

  // Codes an action raises itself, carried through as they are so the screen
  // that knows them can say something specific. They all fell through to
  // "server error" before, so the assistant's own messages ("today's questions
  // are used up") were never shown.
  if ((PASS_THROUGH_CODES as readonly string[]).includes(message)) {
    return { key: `errors.${message}` };
  }

  return { key: 'errors.serverError' };
}

/** Shape returned by every Server Action, so forms handle success and failure alike. */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: AppError };

export function actionError(error: PostgrestError | Error | null | undefined): ActionResult<never> {
  return { ok: false, error: mapDatabaseError(error) };
}

export function actionOk(): ActionResult<void>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}
