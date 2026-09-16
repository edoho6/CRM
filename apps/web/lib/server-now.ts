import 'server-only';

/**
 * The moment the server drew the page.
 *
 * Why this exists rather than `Date.now()` at the call site: a client component
 * that reads the clock while rendering produces one answer on the server and a
 * different one in the browser a moment later, and React throws the markup away
 * when they disagree — the treatment page and the dashboard both hit this. The
 * fix each time is the same: decide the moment once, on the server, and hand it
 * down as a prop, so both renders answer from the same clock.
 *
 * Calling this in a *server* component is safe and is the whole point; it runs
 * once and its output is HTML. The name is there so that a reader of a page can
 * see which value is the page's clock, and so the lint rule that watches for
 * render-time clock reads has one place to be told about instead of four.
 *
 * What it is not: a substitute for the clinic's calendar day. "Today" for a
 * clinic is `dateKeyIn(new Date(), clinic.timezone)` — a date key, in the
 * clinic's zone, never the server's and never UTC.
 */
export function serverNow(): number {
  return Date.now();
}
