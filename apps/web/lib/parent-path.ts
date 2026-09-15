/**
 * The page one level up from the one you are on.
 *
 * "Back" used to be the browser's own history, which is where it goes wrong:
 * open a formula from the reference library, and back takes you to whatever
 * you were looking at before you got there — a patient's file, a treatment,
 * the calendar. The way out of a record is up, not backwards, and up is
 * written in the address: a formula sits in the formula list, which sits in
 * the dashboard.
 *
 * Pure, and takes the locale-less path that `@clinic/i18n/navigation` deals
 * in. `null` means there is nowhere above this — the dashboard itself.
 */

const HOME = '/';

/**
 * Paths that are only a redirect to their first tab.
 *
 * `/reference` has no page of its own; it bounces to the herbs. Going up from
 * the formula list would land there and arrive at the herb list, which is not
 * up, it is sideways. Back from the formula list is the dashboard.
 */
const REDIRECT_ONLY = new Set(['/reference']);

export function parentPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || HOME;
  if (path === HOME) return null;

  const segments = path.split('/').filter(Boolean);
  segments.pop();
  const parent = segments.length === 0 ? HOME : `/${segments.join('/')}`;

  return REDIRECT_ONLY.has(parent) ? HOME : parent;
}
