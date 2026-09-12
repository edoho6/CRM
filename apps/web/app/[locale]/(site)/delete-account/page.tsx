import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '../legal-page';

/**
 * How an account is deleted, what goes and what stays. Public: Google Play
 * asks for exactly this address, and someone who has lost access to the app
 * needs to read it without signing in.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata('deleteAccount', locale);
}

export default async function DeleteAccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage document="deleteAccount" locale={locale} />;
}
