import { defaultLocale, isLocale } from './routing';

/**
 * Loads a message catalogue for a locale.
 *
 * Both apps share one catalogue so a string is translated once. Unknown locales fall
 * back to the default rather than throwing, so a stale bookmark like `/fr/patients`
 * renders in Hebrew instead of crashing the request.
 */
export async function loadMessages(locale: string) {
  const resolved = isLocale(locale) ? locale : defaultLocale;
  const messages = await import(`../messages/${resolved}.json`);
  return messages.default as Record<string, unknown>;
}
