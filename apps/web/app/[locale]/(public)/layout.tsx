import { setRequestLocale } from 'next-intl/server';

/**
 * Pages a patient opens from a link, with no account and no sign-in.
 *
 * Its own route group so it sits outside the staff shell and its three gates:
 * the only thing that decides what these pages show is the token in the URL,
 * checked by the database. Nothing else in the app is reachable from here.
 */
export const dynamic = 'force-dynamic';

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    // Centred on a desk; on a phone the booking form is taller than the
    // window and a centred grid cut its top off, so there it starts at the
    // top and scrolls, with room at the foot for the sticky action bar.
    <main className="flex min-h-dvh flex-col items-center justify-start bg-ink-50 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:justify-center sm:px-6 sm:py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
