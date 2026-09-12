import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalArticle, legalSectionsFrom } from '@clinic/ui';
import { formatDate } from '@clinic/i18n';
import { SiteFrame } from './site-frame';

/** The documents this page can show; each is a block under `legal` in the messages. */
export type LegalDocument = 'privacy' | 'terms' | 'deleteAccount';

/** When each text last changed — a reader is entitled to know. */
const UPDATED: Record<LegalDocument, Date> = {
  privacy: new Date('2026-09-12'),
  terms: new Date('2026-09-12'),
  deleteAccount: new Date('2026-09-12'),
};

const PATHS: Record<LegalDocument, string> = {
  privacy: 'privacy',
  terms: 'terms',
  deleteAccount: 'delete-account',
};

/**
 * The privacy policy, the terms of use and the account-deletion page share
 * one shape: numbered sections from the messages, the operator's details at
 * the foot, indexable, in both languages. Each route file names its
 * document and nothing else.
 *
 * The texts are a draft written from what the system actually does — what is
 * collected, who the providers are, what stays and why — and are on the
 * lawyer's list (GO-LIVE.md §2) before real patients arrive. The operator's
 * name and address are visible placeholders until filled, on purpose.
 */
export async function legalMetadata(document: LegalDocument, locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'legal' });
  const path = PATHS[document];
  return {
    title: t(`${document}.title`),
    description: t(`${document}.subtitle`),
    robots: { index: true, follow: true },
    alternates: { languages: { he: `/he/${path}`, en: `/en/${path}` } },
  };
}

export async function LegalPage({ document, locale }: { document: LegalDocument; locale: string }) {
  setRequestLocale(locale);
  const t = await getTranslations('legal');

  return (
    <SiteFrame>
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
    </SiteFrame>
  );
}
