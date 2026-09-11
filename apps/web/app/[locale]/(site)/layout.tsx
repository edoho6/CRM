import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * The public face: the one page a search for the product should find.
 *
 * Its own route group because it is neither the staff shell (which needs a
 * session) nor a patient's page (which needs a token): a plain page that
 * anyone may read, with the skip link every page starts with and nothing
 * that could reach a clinic's data.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('nav');

  return (
    <div className="min-h-dvh bg-ink-50 text-ink-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus:outline-2 focus:outline-focus"
      >
        {t('skipToContent')}
      </a>
      {children}
    </div>
  );
}
