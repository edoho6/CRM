import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { LegalArticle, legalSectionsFrom } from '@clinic/ui';
import { formatDate } from '@clinic/i18n';
import { Link } from '@clinic/i18n/navigation';

export type LegalDocument = 'privacy' | 'terms';

const UPDATED: Record<LegalDocument, Date> = {
  privacy: new Date('2026-09-12'),
  terms: new Date('2026-09-12'),
};

/**
 * The same two documents the staff app publishes, readable from inside the
 * portal — linked from its sign-in page and its foot — so a patient never
 * has to leave for another site to read what they agreed to. The texts are
 * the shared messages; the staff app's copy is the public, indexed one, and
 * this one is kept out of search like the rest of the portal.
 */
export async function legalMetadata(document: LegalDocument, locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t(`${document}.title`),
    robots: { index: false, follow: false },
  };
}

export async function LegalPage({ document, locale }: { document: LegalDocument; locale: string }) {
  setRequestLocale(locale);
  const t = await getTranslations('legal');
  const tc = await getTranslations('common');

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6">
      <p className="pt-5">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-jade-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
          {tc('back')}
        </Link>
      </p>
      <LegalArticle
        title={t(`${document}.title`)}
        subtitle={t(`${document}.subtitle`)}
        sections={legalSectionsFrom(t.raw(`${document}.sections`))}
        operator={{
          title: t('operator.title'),
          name: t('operator.name'),
          email: t('operator.email'),
          placeholder: /[\[\]]/.test(t('operator.name')),
          warning: t('operator.warning'),
        }}
        updated={t('updated', { date: formatDate(UPDATED[document]) })}
      />
    </main>
  );
}
