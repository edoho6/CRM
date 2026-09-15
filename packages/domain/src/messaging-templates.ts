import { MARKETING_AUTOMATION_KINDS, type AutomationKind, type Locale } from './enums';

/**
 * The automated messages' wording, as the settings card previews it.
 *
 * The database renders the real thing (`render_automation` in migration 54)
 * because the hourly job runs with no app around to ask. This is its mirror
 * for the preview under the textarea, and a test holds the two to the same
 * words: every default here must appear verbatim in the migration.
 *
 * Placeholders are the same on both sides — {name} {clinic} {link}
 * {booking_link} {unsubscribe} — and an unknown one is left as typed, so a
 * practitioner who wrote "{שם}" by mistake sees it in the preview rather than
 * having it silently vanish.
 */
export interface AutomationFacts {
  name: string;
  clinic: string;
  link?: string;
  booking_link?: string;
  unsubscribe?: string;
}

/** The placeholders each kind may use, in the order a WhatsApp template's variables take them. */
export const AUTOMATION_PLACEHOLDERS: Record<AutomationKind, readonly (keyof AutomationFacts)[]> = {
  treatment_followup: ['name', 'clinic'],
  birthday: ['name', 'clinic', 'unsubscribe'],
  inactive_reengage: ['name', 'clinic', 'booking_link', 'unsubscribe'],
  review_request: ['name', 'clinic', 'link', 'unsubscribe'],
};

/** The line every marketing message ends with unless the clinic placed {unsubscribe} itself. */
export const UNSUBSCRIBE_LINE: Record<Locale, string> = {
  he: 'להסרה מהודעות כאלה: {unsubscribe}',
  en: 'To stop these messages: {unsubscribe}',
};

const DEFAULTS: Record<Exclude<AutomationKind, 'inactive_reengage'>, Record<Locale, string>> = {
  treatment_followup: {
    he: 'שלום {name}, איך ההרגשה אחרי הטיפול ב-{clinic}? נשמח לשמוע, ואם משהו מטריד, אפשר לפנות אלינו.',
    en: 'Hi {name}, how are you feeling after your treatment at {clinic}? We would love to hear, and if anything is bothering you, get in touch.',
  },
  birthday: {
    he: 'שלום {name}, מזל טוב ליום ההולדת מכולנו ב-{clinic}! שתהיה שנה של בריאות.',
    en: 'Happy birthday {name}, from all of us at {clinic}! Wishing you a year of good health.',
  },
  review_request: {
    he: 'שלום {name}, תודה שבחרת ב-{clinic}. אם היה טוב, נשמח לחוות דעת קצרה בגוגל: {link}',
    en: 'Hi {name}, thank you for choosing {clinic}. If you were happy, a short Google review would mean a lot: {link}',
  },
};

/** The nudge has two shapes: with the booking link when the clinic has a booking page, without it otherwise. */
const REENGAGE_DEFAULTS: Record<'with' | 'without', Record<Locale, string>> = {
  with: {
    he: 'שלום {name}, עבר זמן מאז הביקור האחרון ב-{clinic}. נשמח לראותך שוב. לקביעת תור: {booking_link}',
    en: 'Hi {name}, it has been a while since your last visit to {clinic}. We would be glad to see you again. To book: {booking_link}',
  },
  without: {
    he: 'שלום {name}, עבר זמן מאז הביקור האחרון ב-{clinic}. נשמח לראותך שוב.',
    en: 'Hi {name}, it has been a while since your last visit to {clinic}. We would be glad to see you again.',
  },
};

/** Every built-in wording, for the test that holds them to the migration's. */
export const AUTOMATION_DEFAULT_TEXTS: readonly string[] = [
  ...Object.values(DEFAULTS).flatMap((byLocale) => Object.values(byLocale)),
  ...Object.values(REENGAGE_DEFAULTS).flatMap((byLocale) => Object.values(byLocale)),
  ...Object.values(UNSUBSCRIBE_LINE),
];

/** The built-in wording of one kind, in one language. */
export function automationDefault(
  kind: AutomationKind,
  locale: Locale,
  options: { hasBookingLink?: boolean } = {},
): string {
  if (kind === 'inactive_reengage') {
    return REENGAGE_DEFAULTS[options.hasBookingLink ? 'with' : 'without'][locale];
  }
  return DEFAULTS[kind][locale];
}

export function isMarketingAutomation(kind: AutomationKind): boolean {
  return (MARKETING_AUTOMATION_KINDS as readonly string[]).includes(kind);
}

/**
 * The message as the patient will read it: the clinic's wording or the
 * built-in one, the removal line on a marketing kind, and the blanks filled.
 */
export function fillAutomationTemplate(
  kind: AutomationKind,
  template: string | null | undefined,
  locale: Locale,
  facts: AutomationFacts,
): string {
  let text = (template ?? '').trim();
  if (!text) text = automationDefault(kind, locale, { hasBookingLink: Boolean(facts.booking_link) });
  if (isMarketingAutomation(kind) && !text.includes('{unsubscribe}')) {
    text = `${text}\n${UNSUBSCRIBE_LINE[locale]}`;
  }
  return text.replace(
    /\{(name|clinic|link|booking_link|unsubscribe)\}/g,
    (_match, key: keyof AutomationFacts) => facts[key] ?? '',
  );
}
