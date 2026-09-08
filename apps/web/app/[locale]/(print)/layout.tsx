import { redirect } from '@clinic/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isSupabaseConfigured } from '@clinic/db';
import type { Locale } from '@clinic/domain';
import { getMembershipContext } from '@/lib/session';

/**
 * Pages that exist to be printed.
 *
 * Its own route group, with the same three gates as the app shell and none of
 * the shell: no sidebar, no top bar, no open-files strip. Hiding those with
 * `.no-print` would have worked on paper and left the screen showing a document
 * wedged into a quarter of the window — and these are pages you read on screen
 * to check before you print them.
 *
 * The gates are repeated rather than shared because a route group's layout does
 * not inherit from a sibling's. That is three lines of duplication against a
 * document that would otherwise be reachable without a session.
 */
export const dynamic = 'force-dynamic';

export default async function PrintLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isSupabaseConfigured()) {
    redirect({ href: '/setup', locale: locale as Locale });
  }

  const context = await getMembershipContext();
  if (!context) {
    redirect({ href: '/login', locale: locale as Locale });
    // Unreachable: next-intl's redirect throws but is typed as returning void.
    return null;
  }

  return (
    <main
      id="main-content"
      className="mx-auto max-w-3xl bg-white p-6 text-ink-900 sm:p-10 print:max-w-none print:p-0"
    >
      {children}
    </main>
  );
}
