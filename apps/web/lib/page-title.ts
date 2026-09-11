import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * The browser-tab title of a page.
 *
 * Every screen used to be titled "הרבליסט" and nothing else, so a screen
 * reader announced the same word on every navigation and twelve open tabs
 * were indistinguishable. A page exports
 * `export const generateMetadata = pageTitle('patients', 'title')` and gets
 * its heading as the title; the root layout's template adds the app's name
 * after it.
 *
 * Record pages (a patient, a treatment, a herb) name their kind rather than
 * the record — the title is computed before the page has loaded the row,
 * and a second query just for the tab was not worth it.
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
