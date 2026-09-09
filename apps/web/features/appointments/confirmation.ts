import type { Appointment } from '@clinic/db/types';

/**
 * Where a booking stands with the patient, in one word.
 *
 * Four states, because the practitioner's question the night before is a
 * four-way one: did I remind them, did they answer, and which way. The colour
 * on the calendar block and in every list comes from this and nothing else, so
 * the same booking never looks green in one place and grey in another.
 *
 *   none      — no reminder has gone out, and nothing has been heard.
 *   sent      — reminded, no answer yet.
 *   confirmed — the patient said they are coming (or the desk marked it so).
 *   declined  — the patient said they are not.
 *
 * A confirmed *status* counts as confirmed even without a response: the desk
 * confirming by phone is as good as a tap on the link.
 */
export type ConfirmationState = 'none' | 'sent' | 'confirmed' | 'declined';

export type ConfirmationFields = Pick<
  Appointment,
  'status' | 'reminder_sent_at' | 'confirmation_response'
>;

export function confirmationState(appointment: ConfirmationFields): ConfirmationState {
  if (appointment.confirmation_response === 'declined') return 'declined';
  if (appointment.confirmation_response === 'confirmed' || appointment.status === 'confirmed') {
    return 'confirmed';
  }
  if (appointment.reminder_sent_at) return 'sent';
  return 'none';
}

/**
 * The reminder text, with the blanks filled.
 *
 * The clinic's own wording when it has set one, otherwise the built-in text
 * for the patient's language. Unknown placeholders are left as typed: a
 * practitioner who wrote "{שם}" by mistake should see it in the preview rather
 * than have it silently vanish.
 */
export interface ReminderFacts {
  name: string;
  date: string;
  time: string;
  clinic: string;
  link: string;
}

export function fillReminderTemplate(template: string, facts: ReminderFacts): string {
  return template.replace(/\{(name|date|time|clinic|link)\}/g, (_match, key: keyof ReminderFacts) =>
    facts[key],
  );
}

/** The public page that answers a reminder link, on whatever host the app runs. */
export function confirmationPath(locale: string, token: string): string {
  return `/${locale}/confirm/${token}`;
}
