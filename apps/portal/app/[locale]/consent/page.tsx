import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldCheck } from 'lucide-react';
import { Alert, EmptyState } from '@clinic/ui';
import { getCurrentUser, isSupabaseConfigured, tryCreateServerSupabase } from '@clinic/db';
import type { ConsentDocument, PatientConsentStatus } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { ConsentCard } from './consent-card';
import { PortalNav } from '../portal-nav';

/**
 * What the patient has agreed to, and the ability to change it.
 *
 * Only published documents, and only in the language being read: a consent
 * should cite the text the person was actually shown. Where a kind has several
 * versions, the newest is the one offered — that is what publishing a new
 * version means.
 *
 * `consent_documents_patient_read` and `patient_consents_patient_insert` have
 * existed since consent was built. This page is the first thing to use them.
 */
export const dynamic = 'force-dynamic';

export default async function PortalConsentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('portal.consent');
  const tc = await getTranslations('common');

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <Alert tone="warning">{tc('errorGeneric')}</Alert>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: locale as Locale });
    return null;
  }

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return null;

  const { data: patientId } = await supabase.rpc('current_patient_id');
  if (!patientId) {
    redirect({ href: '/', locale: locale as Locale });
    return null;
  }

  const [documentsResult, statusResult] = await Promise.all([
    supabase
      .from('consent_documents')
      .select('*')
      .not('published_at', 'is', null)
      .eq('locale', locale)
      .order('version', { ascending: false })
      .returns<ConsentDocument[]>(),
    supabase.from('patient_consent_status').select('*').returns<PatientConsentStatus[]>(),
  ]);

  // Newest published version per kind. The list arrives ordered, so the first
  // of each kind is the current one.
  const current = new Map<string, ConsentDocument>();
  for (const document of documentsResult.data ?? []) {
    if (!current.has(document.kind)) current.set(document.kind, document);
  }

  const statuses = statusResult.data ?? [];
  const documents = [...current.values()];

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <PortalNav current="consent" />

      <h1 className="text-xl font-semibold text-ink-900">{t('title')}</h1>
      <p className="text-sm text-ink-700">{t('intro')}</p>

      {documents.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title={t('none')} />
      ) : (
        <div className="space-y-5">
          {documents.map((document) => {
            const status = statuses.find((entry) => entry.kind === document.kind) ?? null;
            return (
              <ConsentCard
                key={document.id}
                documentId={document.id}
                kind={document.kind}
                title={document.title}
                body={document.body}
                version={document.version}
                decided={status !== null}
                granted={status?.granted === true}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
