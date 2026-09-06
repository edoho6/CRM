import { redirect } from '@clinic/i18n/navigation';
import type { Locale } from '@clinic/domain';

/** The library has no landing page of its own; the herbs are the front door. */
export default async function ReferencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/reference/herbs', locale: locale as Locale });
  // Unreachable: next-intl's redirect throws but is typed as returning void.
  return null;
}
