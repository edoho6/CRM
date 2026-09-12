import type { Metadata } from 'next';
import { Assistant } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { getDirection, isLocale, locales } from '@clinic/i18n';
import type { Viewport } from 'next';
import { ConfirmProvider, ToastProvider, UiDirectionProvider, UiLabelsProvider } from '@clinic/ui';
import { NativeShellBridge } from '@clinic/native';
import { THEME_COLORS, themeInitScript } from '@/lib/theme';
import '../globals.css';

/**
 * Root layout.
 *
 * This is the single place text direction is decided. `dir` is set on <html> so it
 * cascades through native CSS and every logical property (ms/me/ps/pe, text-start)
 * resolves correctly, and Radix's DirectionProvider mirrors it for floating UI.
 */

/**
 * Assistant, self-hosted.
 *
 * The stack in `globals.css` has always named this font first, but nothing ever
 * shipped it — no font file in the repo, no `next/font`, no stylesheet link. So
 * it only applied to someone who happened to have it installed, and on a stock
 * Windows machine the app quietly fell through to Segoe UI and looked like a
 * system dialog. This is the line that was missing, not a change of direction.
 *
 * `next/font/google` downloads the file at build time and serves it from our
 * own domain. The browser never contacts Google, which matters here beyond
 * performance: a webfont request from the patient portal would hand Google the
 * IP address of every patient who opens it, and this project does not send
 * patient traffic to third parties.
 *
 * The variable cut carries 200–800 in one file, so the weights already in use
 * cost nothing extra. Hebrew and Latin both, because a clinical record mixes
 * them constantly — pinyin, botanical names, point codes.
 */
const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  display: 'swap',
  variable: '--font-assistant',
  // Falls back to the same stack the CSS names, so a failed download degrades
  // to what the app looked like before rather than to a serif.
  fallback: ['Segoe UI', 'system-ui', 'Noto Sans Hebrew', 'Arial'],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * `viewportFit: 'cover'` is what makes `env(safe-area-inset-*)` non-zero on
 * an iPhone — without it every bottom sheet sat under the home indicator.
 * `resizes-content` makes the software keyboard shrink the page instead of
 * covering the field being typed in. The theme colour is the page background;
 * the script below and the theme switch move it with the theme.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: THEME_COLORS.light,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    // Absolute addresses for the share images and alternates come from here.
    metadataBase: new URL((process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')),
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
  // The feedback providers are client components with no access to the
  // catalogue; their few labels cross the boundary as strings, which is the
  // one kind of value that may.
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <html lang={locale} dir={dir} className={assistant.variable} suppressHydrationWarning>
      {/* suppressHydrationWarning here (not just on <html>) because some browser
          extensions inject attributes onto <body> before React hydrates — that is
          a false-positive mismatch, not a real bug, and Next.js recommends this
          exact fix for it. */}
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        {/* Sets `data-theme` before anything paints, from the stored choice or
            the system preference. Without it, anyone using dark gets a flash of
            the light theme on every page load. It writes one attribute and costs
            well under a millisecond.

            Emitted as raw HTML rather than as a `<script>` element, and the
            reason is worth stating because both obvious alternatives are wrong.

            A `<script>` rendered as a React child makes React 19 warn — fairly:
            it cannot execute one during a client render. But `next/script` with
            `beforeInteractive` is not the fix either. It does not emit a script
            the parser runs; it pushes the source onto Next's own `__next_s`
            queue, to be executed once Next's runtime boots. That is after the
            first paint, which is precisely the flash this exists to prevent.

            Written into the markup, the browser parses and runs it in document
            order, before the body renders — the original behaviour — and React
            never has a script element in its tree to object to. On a client-side
            navigation the tag is inert, which is correct: the theme is set. */}
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: `<script>${themeInitScript}</script>` }}
        />
        {/* Inside the store app only — the status bar, the back button, the
            splash. In a browser it renders nothing and loads nothing. */}
        <NativeShellBridge />
        <NextIntlClientProvider messages={messages}>
          <UiDirectionProvider dir={dir}>
            {/* Toasts and the confirm dialog live at the root so any screen can
                raise one, and inside the direction provider so the dialog's
                Radix primitives lay out for Hebrew. */}
            <ToastProvider closeLabel={t('close')}>
              <ConfirmProvider
                confirmLabel={t('confirm')}
                cancelLabel={t('cancel')}
                closeLabel={t('close')}
              >
                {/* Words for controls that live inside shared primitives — the
                    row-size switch on every list table — so no table has to
                    pass them itself. */}
                <UiLabelsProvider
                  labels={{
                    tableSize: {
                      title: t('tableSize.title'),
                      compact: t('tableSize.compact'),
                      regular: t('tableSize.regular'),
                      large: t('tableSize.large'),
                    },
                    dateInput: {
                      placeholder: t('dateInput.placeholder'),
                      openCalendar: t('dateInput.openCalendar'),
                      invalid: t('dateInput.invalid'),
                    },
                    dialog: { close: t('close') },
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
