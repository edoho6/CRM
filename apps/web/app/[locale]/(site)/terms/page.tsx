import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '../legal-page';

/** The terms of use. Public and indexable. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata('terms', locale);
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage document="terms" locale={locale} />;
}
