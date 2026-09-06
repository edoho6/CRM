import type { Locale } from '@clinic/domain';

/** Picks the appointment type name matching the reader's language. */
export function appointmentTypeName(
  type: { name_he?: string | null; name_en?: string | null } | null | undefined,
  locale: Locale,
): string {
  if (!type) return '';
  return (
    (locale === 'he' ? type.name_he : type.name_en)?.trim() ||
    type.name_en?.trim() ||
    type.name_he?.trim() ||
    ''
  );
}
