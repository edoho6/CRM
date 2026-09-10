import type { Metadata } from 'next';
import { Assistant } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { getDirection, isLocale, locales } from '@clinic/i18n';
import { ConfirmProvider, ToastProvider, UiDirectionProvider, UiLabelsProvider } from '@clinic/ui';
import '../globals.css';

/* The same font as the staff app, declared separately because these are two
   builds — see the note there for why it is self-hosted rather than linked.
   The privacy half of that reasoning applies most of all here: this is the app
   patients actually open. */
const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  display: 'swap',
  variable: '--font-assistant',
  fallback: ['Segoe UI', 'system-ui', 'Noto Sans Hebrew', 'Arial'],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal' });
  return { title: t('title') };
}

export default async function PortalLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = getDirection(locale);
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <html lang={locale} dir={dir} className={assistant.variable} suppressHydrationWarning>
      <body className="min-h-dvh text-base antialiased" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <UiDirectionProvider dir={dir}>
            {/* Same providers as the staff app, for parity: a portal screen that
                wants to confirm something should not have to invent its own. */}
            <ToastProvider closeLabel={t('close')}>
              <ConfirmProvider
                confirmLabel={t('confirm')}
                cancelLabel={t('cancel')}
                closeLabel={t('close')}
              >
                {/* Words for controls inside shared primitives — the date
                    field in a questionnaire — so no screen passes them itself. */}
                <UiLabelsProvider
                  labels={{
                    dateInput: {
                      placeholder: t('dateInput.placeholder'),
                      openCalendar: t('dateInput.openCalendar'),
                      invalid: t('dateInput.invalid'),
                    },
                  }}
                >
                  {children}
                </UiLabelsProvider>
              </ConfirmProvider>
            </ToastProvider>
          </UiDirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
