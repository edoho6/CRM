import { CLINIC_TIME_ZONE } from './formats';

/**
 * Numeric dates, as `dd/MM/yyyy`, in both languages.
 *
 * Deliberately not `format.dateTime(…, 'short')`. That routes through the
 * locale's own conventions, and the two conventions disagree in ways a clinic
 * cannot live with: `en` resolves to American order and renders the third of
 * September as `09/03/2026`, while `he` renders it `03.09.2026` with dots. One
 * of those is wrong by a month and the other is merely inconsistent, and a
 * practitioner reading a treatment date should never have to work out which
 * spelling they are looking at.
 *
 * So the pattern is fixed rather than negotiated. `en-GB` is used purely as the
 * means — it is the locale whose numeric convention is day-first with slashes —
 * and the language of the interface has no bearing on it. Month *names* stay
 * localised; those still go through next-intl.
 *
 * The time zone is pinned to the clinic's for the same reason the rest of the
 * formats are: an appointment at nine in the morning must read nine in the
 * morning, whatever the machine's clock is set to.
 */

const PATTERN = 'en-GB';

const dateFormatter = new Intl.DateTimeFormat(PATTERN, {
  timeZone: CLINIC_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(PATTERN, {
  timeZone: CLINIC_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const timeFormatter = new Intl.DateTimeFormat(PATTERN, {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * An unparseable value renders as a dash rather than "Invalid Date".
 *
 * These are fed from database columns and from typed input, and a row with a
 * missing date should look like a row with a missing date.
 */
function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `dd/MM/yyyy`. */
export function formatDate(value: Date | string | number): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
}

/** `dd/MM/yyyy, HH:mm` — 24-hour, never am/pm. */
export function formatDateTime(value: Date | string | number): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

/** `HH:mm` — 24-hour. */
export function formatTime(value: Date | string | number): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '—';
}

/**
 * The weekday's name, in the language of the interface.
 *
 * The numeric formats above are deliberately locale-blind; a weekday is the
 * opposite — "Tue" in a Hebrew sentence is the one part of a date that must be
 * translated. Kept beside them so a caller that wants "day, date, time" has all
 * three from one place, and formats each as its own run: a weekday followed
 * straight by two numeric runs is three fields the bidi algorithm is free to
 * reorder into one unreadable number.
 */
export function formatWeekday(value: Date | string | number, locale: string): string {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    weekday: 'short',
  }).format(date);
}
