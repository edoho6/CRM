import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '../legal-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata('privacy', locale);
}

export default async function PortalPrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage document="privacy" locale={locale} />;
}
