import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '../legal-page';

/** The privacy policy. Public and indexable; the stores link to it. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata('privacy', locale);
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage document="privacy" locale={locale} />;
}
