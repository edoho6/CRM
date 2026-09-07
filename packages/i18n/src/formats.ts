import type { Formats } from 'next-intl';

/**
 * Shared date/number/currency formats.
 *
 * All formatting goes through these so a Hebrew user and an English user see the
 * same instant rendered per their locale conventions, with no hand-rolled date code
 * anywhere in the app.
 */
export const formats = {
  dateTime: {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    weekday: { weekday: 'long', day: 'numeric', month: 'long' },
    /** The heading over a month grid: "ספטמבר 2026", "September 2026". */
    monthYear: { month: 'long', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit', hour12: false },
    dateTime: {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  },
  number: {
    currency: { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 },
    grams: { style: 'unit', unit: 'gram', maximumFractionDigits: 2 },
    decimal: { maximumFractionDigits: 2 },
    integer: { maximumFractionDigits: 0 },
  },
} satisfies Formats;

/** The clinic operates on Israel time; all calendar maths is anchored here. */
export const CLINIC_TIME_ZONE = 'Asia/Jerusalem';
