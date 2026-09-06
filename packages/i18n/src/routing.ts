import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@clinic/domain';

/**
 * Single source of truth for locale routing, shared by both apps.
 *
 * `localePrefix: 'always'` keeps `/he/...` and `/en/...` explicit in the URL. That
 * matters here because the clinic works in Hebrew day to day but shares links with
 * English speakers — an explicit prefix makes a shared link unambiguous.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeDetection: true,
});

export const locales = LOCALES;
export const defaultLocale = DEFAULT_LOCALE;
export type { Locale };

/** Text direction for a locale. Hebrew is the only RTL language we ship today. */
export function getDirection(locale: string): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Display names used by the language switcher (each shown in its own language). */
export const LOCALE_LABELS: Record<Locale, string> = {
  he: 'עברית',
  en: 'English',
};
