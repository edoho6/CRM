import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { getDirection, isLocale, locales } from '@clinic/i18n';
import { UiDirectionProvider } from '@clinic/ui';
import '../globals.css';

/**
 * Root layout.
 *
 * This is the single place text direction is decided. `dir` is set on <html> so it
 * cascades through native CSS and every logical property (ms/me/ps/pe, text-start)
 * resolves correctly, and Radix's DirectionProvider mirrors it for floating UI.
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    title: {
      default: t('appName'),
      template: `%s · ${t('appName')}`,
    },
    description: t('appTagline'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = getDirection(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      {/* suppressHydrationWarning here (not just on <html>) because some browser
          extensions inject attributes onto <body> before React hydrates — that is
          a false-positive mismatch, not a real bug, and Next.js recommends this
          exact fix for it. */}
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <UiDirectionProvider dir={dir}>{children}</UiDirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
