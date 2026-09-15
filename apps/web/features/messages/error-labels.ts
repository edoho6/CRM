/**
 * The short codes a failed message carries, and the key that explains each.
 *
 * The sender keeps a code on the row — `no_credit`, `needs_template` — and
 * never the service's own words. The screen turns the code into a sentence
 * that says what to do; a code it has not met (`http_503`, `provider_42`)
 * gets the general one rather than leaking a key onto the page.
 */
export const MESSAGE_ERROR_KEYS = [
  'auth_failed',
  'no_credit',
  'no_permission',
  'bad_number',
  'foreign_number',
  'needs_template',
  'blocked',
  'too_long',
  'bad_sender',
  'no_recipient',
  'no_device',
  'synthetic_clinic',
  'provider_error',
  'skipped_by_staff',
  'no_whatsapp_number',
  'not_delivered',
  'template_not_approved',
  'daily_limit',
  'rate_limit',
  'outdated_app',
] as const;

export type MessageErrorKey = (typeof MESSAGE_ERROR_KEYS)[number] | 'other';

export function messageErrorKey(code: string | null | undefined): MessageErrorKey {
  return (MESSAGE_ERROR_KEYS as readonly string[]).includes(code ?? '') ? (code as MessageErrorKey) : 'other';
}
