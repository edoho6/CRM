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
    <main className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
