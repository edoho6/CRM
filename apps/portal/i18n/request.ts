import { getRequestConfig } from 'next-intl/server';
import { CLINIC_TIME_ZONE, defaultLocale, formats, isLocale, loadMessages } from '@clinic/i18n';

/**
 * Same locale configuration as the staff app, including the clinic's time zone —
 * a patient travelling abroad must still see their appointment at the hour the
 * clinic booked it.
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
