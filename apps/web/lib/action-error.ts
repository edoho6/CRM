/**
 * The sentence to show when a server action fails.
 *
 * Every action returns a typed error key ("errors.overlap", "errors.locked"),
 * and every message catalogue has a sentence for it. Four forms threw that
 * away and showed the same "something went wrong, try again" for a clash, a
 * locked record and a lost connection alike. This resolves the key when the
 * catalogue knows it, and falls back to the generic line only when it does
 * not.
 *
 * `t` is the root translator (`useTranslations()` with no namespace), so any
 * key the action returns can be looked up in full.
 */
export function describeActionError(
  t: { has: (key: string) => boolean; (key: string): string },
  key: string | null | undefined,
): string {
  if (key && t.has(key)) return t(key);
  return t('common.errorGeneric');
}
