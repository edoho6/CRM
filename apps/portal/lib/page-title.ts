import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * The browser-tab title of a portal page — the same helper as the staff app's
 * `lib/page-title.ts`. Without it every tab read "אזור אישי", and a screen
 * reader announced that on every navigation; the layout's template adds it
 * after the page's own name instead.
 */
export function pageTitle(namespace: string, key = 'title') {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });
    return { title: t(key) };
  };
}
