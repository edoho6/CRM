import { getRequestConfig } from 'next-intl/server';
import { CLINIC_TIME_ZONE, defaultLocale, formats, isLocale, loadMessages } from '@clinic/i18n';

/**
 * Per-request locale configuration consumed by the next-intl plugin.
 *
 * The time zone is pinned to the clinic's rather than the visitor's: an appointment
 * at 09:00 must read 09:00 for the practitioner regardless of where the browser is.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    formats,
    timeZone: CLINIC_TIME_ZONE,
    now: new Date(),
  };
});
